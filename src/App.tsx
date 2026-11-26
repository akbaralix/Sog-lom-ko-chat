import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { DiagnoseScreen } from './components/DiagnoseScreen';
import { HomeScreen } from './components/HomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { OfflineIndicator } from './components/PWAInstallCard';
import { ProfileScreen } from './components/ProfileScreen';
import { SeedlingDetailScreen } from './components/SeedlingDetailScreen';
import {
  initTelegramMiniAppShell,
  waitForTelegramWebAppInitData,
} from './lib/telegramClient';
import {
  authFetch,
  clearStoredAuthToken,
  getStoredAuthToken,
  registerSessionCallbacks,
  setStoredAuthToken,
} from './lib/clientSession';
import type { AppTab, DiagnosisRecord, SeedlingItem, UserProfile } from './types';

export default function App() {
  const [token, setToken] = useState<string | null>(() => getStoredAuthToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedSeedling, setSelectedSeedling] = useState<SeedlingItem | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<DiagnosisRecord | null>(null);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [webAppAuthContext, setWebAppAuthContext] = useState<{
    challengeId: string;
    initData: string;
    telegramUser: {
      id: number;
      name: string;
      username: string | null;
      photoUrl: string | null;
    };
  } | null>(null);
  const [booting, setBooting] = useState<boolean>(() => typeof window !== 'undefined');

  useEffect(() => {
    registerSessionCallbacks({
      onRecovered: (newToken, recoveredUser) => {
        if (newToken) {
          setStoredAuthToken(newToken);
          setToken(newToken);
        }
        setUser(recoveredUser);
      },
      onExpired: () => {
        clearStoredAuthToken();
        setToken(null);
        setUser(null);
      },
    });
    return () => {
      registerSessionCallbacks({});
    };
  }, []);

  useEffect(() => {
    initTelegramMiniAppShell();
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    let cancelled = false;
    void (async () => {
      try {
        if (autostart) {
          const res = await fetch('/api/auth/demo', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          });
          const data = (await res.json()) as { token?: string; user?: UserProfile };
          if (!cancelled && res.ok && data.user) {
            if (data.token) {
              setStoredAuthToken(data.token);
              setToken(data.token);
            }
            setUser(data.user);
          }
          return;
        }

        const savedToken = getStoredAuthToken();
        const sessionHeaders: Record<string, string> = {};
        if (savedToken) {
          sessionHeaders.Authorization = `Bearer ${savedToken}`;
        }
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          headers: sessionHeaders,
        });
        if (res.ok) {
          const data = (await res.json()) as {
            authenticated?: boolean;
            token?: string | null;
            user?: UserProfile | null;
          };
          if (!cancelled && data.authenticated && data.user) {
            const activeToken = data.token ?? savedToken ?? null;
            if (activeToken) {
              setStoredAuthToken(activeToken);
              setToken(activeToken);
            }
            setUser(data.user);
            const returnOrderId = params.get('payment_order');
            if (returnOrderId) {
              setActiveTab('profile');
              try {
                const pRes = await authFetch(
                  `/api/payments/${encodeURIComponent(returnOrderId)}`,
                  {},
                  activeToken,
                );
                if (pRes.ok) {
                  const pData = (await pRes.json()) as { user?: UserProfile };
                  if (!cancelled && pData.user) {
                    setUser(pData.user);
                  }
                }
              } catch {
                // Ignore transient check failure
              }
            }
            return;
          }
          if (!data.authenticated && savedToken) {
            clearStoredAuthToken();
            if (!cancelled) setToken(null);
          }
        }

        const initData = await waitForTelegramWebAppInitData();
        if (initData) {
          initTelegramMiniAppShell();
          const webRes = await fetch('/api/auth/telegram/webapp', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ initData }),
          });
          if (webRes.ok) {
            const webData = (await webRes.json()) as {
              status?: 'verified' | 'needs_phone';
              token?: string;
              user?: UserProfile;
              challengeId?: string;
              telegramUser?: {
                id: number;
                name: string;
                username: string | null;
                photoUrl: string | null;
              };
            };
            if (!cancelled && webData.status === 'verified' && webData.token && webData.user) {
              setStoredAuthToken(webData.token);
              setToken(webData.token);
              setUser(webData.user);
              return;
            }
            if (!cancelled && webData.status === 'needs_phone' && webData.challengeId && webData.telegramUser) {
              setWebAppAuthContext({
                challengeId: webData.challengeId,
                initData,
                telegramUser: webData.telegramUser,
              });
            }
          }
        }
      } catch {
        // Fall back to login screen
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // Ignore network errors on logout
    }
    clearStoredAuthToken();
    setToken(null);
    setUser(null);
    setSelectedSeedling(null);
    setFollowUpTarget(null);
    setActiveTab('home');
  }

  function handleSelectTab(tab: AppTab) {
    setSelectedSeedling(null);
    setActiveTab(tab);
  }

  function handleOpenProUpgrade() {
    setSelectedSeedling(null);
    setActiveTab('profile');
    setProModalOpen(true);
  }

  function handleStartFollowUp(diagnosis: DiagnosisRecord) {
    setSelectedSeedling(null);
    setFollowUpTarget(diagnosis);
    setActiveTab('camera');
  }

  return (
    <div className="min-h-dvh w-full flex justify-center bg-[#E8ECEF]">
      <div className="w-full max-w-[430px] min-h-dvh bg-[#F4F4F5] flex flex-col relative shadow-sm">
        <OfflineIndicator />
        {booting ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <p className="text-[14px] text-[#707579]">Yuklanmoqda...</p>
          </div>
        ) : !user ? (
          <LoginScreen
            initialWebAppAuth={webAppAuthContext}
            onAuthenticated={(newToken, newUser) => {
              setWebAppAuthContext(null);
              setStoredAuthToken(newToken);
              setToken(newToken);
              setUser(newUser);
              setActiveTab('home');
            }}
          />
        ) : (
          <>
            {selectedSeedling ? (
              <SeedlingDetailScreen
                seedling={selectedSeedling}
                onBack={() => setSelectedSeedling(null)}
                token={token}
                user={user}
                onUserUpdated={setUser}
              />
            ) : activeTab === 'home' ? (
              <HomeScreen onSelectSeedling={setSelectedSeedling} />
            ) : activeTab === 'camera' ? (
              <DiagnoseScreen
                token={token}
                user={user}
                onUserUpdated={setUser}
                onOpenProUpgrade={handleOpenProUpgrade}
                followUpTarget={followUpTarget}
                onClearFollowUp={() => setFollowUpTarget(null)}
              />
            ) : (
              <ProfileScreen
                token={token}
                user={user}
                onUserUpdated={setUser}
                onLogout={handleLogout}
                proModalOpen={proModalOpen}
                onSetProModalOpen={setProModalOpen}
                onStartFollowUp={handleStartFollowUp}
              />
            )}

            <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
          </>
        )}
      </div>
    </div>
  );
}

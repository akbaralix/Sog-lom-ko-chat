import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Phone, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types';
import { getTelegramWebApp, getTelegramWebAppInitData } from '../lib/telegramClient';
import { AppLogo } from './AppLogo';
import { PWAInstallCard } from './PWAInstallCard';

export interface WebAppAuthContext {
  challengeId: string;
  initData: string;
  telegramUser: {
    id: number;
    name: string;
    username: string | null;
    photoUrl: string | null;
  };
}

interface LoginScreenProps {
  initialWebAppAuth?: WebAppAuthContext | null;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

interface InitResponse {
  challengeId: string;
  deepLink: string;
  botUsername: string;
  botConfigured: boolean;
}

export function LoginScreen({ initialWebAppAuth = null, onAuthenticated }: LoginScreenProps) {
  const [webAppAuth, setWebAppAuth] = useState<WebAppAuthContext | null>(initialWebAppAuth);
  const [step, setStep] = useState<'welcome' | 'webapp_phone' | 'bot_wait' | 'preview_bot'>(() =>
    initialWebAppAuth ? 'webapp_phone' : 'welcome',
  );
  const [initData, setInitData] = useState<InitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyingContact, setVerifyingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview Telegram bot verification state (when TELEGRAM_BOT_TOKEN is not yet configured)
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+998');
  const [isOwnContact, setIsOwnContact] = useState(true);

  useEffect(() => {
    if (initialWebAppAuth) {
      setWebAppAuth(initialWebAppAuth);
      setStep('webapp_phone');
    }
  }, [initialWebAppAuth]);

  const activeChallengeId =
    step === 'bot_wait'
      ? initData?.challengeId
      : step === 'webapp_phone'
        ? webAppAuth?.challengeId
        : undefined;

  useEffect(() => {
    if (!activeChallengeId) return;

    let cancelled = false;
    const pollMs = step === 'webapp_phone' ? 1000 : 2000;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth/telegram/status/${encodeURIComponent(activeChallengeId)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: 'pending' | 'verified' | 'rejected';
          error?: string | null;
          token?: string;
          user?: UserProfile;
        };
        if (cancelled) return;
        if (data.status === 'verified' && data.token && data.user) {
          clearInterval(timer);
          onAuthenticated(data.token, data.user);
        } else if (data.status === 'rejected' && data.error) {
          setVerifyingContact(false);
          setError(data.error);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [step, activeChallengeId, onAuthenticated]);

  async function handleStartTelegramLogin() {
    setLoading(true);
    setError(null);
    try {
      const miniAppInitData = getTelegramWebAppInitData();
      if (miniAppInitData) {
        const webRes = await fetch('/api/auth/telegram/webapp', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ initData: miniAppInitData }),
        });
        const webData = (await webRes.json()) as {
          status?: 'verified' | 'needs_phone';
          token?: string;
          user?: UserProfile;
          challengeId?: string;
          telegramUser?: WebAppAuthContext['telegramUser'];
          error?: string;
        };
        if (webRes.ok && webData.status === 'verified' && webData.token && webData.user) {
          onAuthenticated(webData.token, webData.user);
          return;
        }
        if (webRes.ok && webData.status === 'needs_phone' && webData.challengeId && webData.telegramUser) {
          setWebAppAuth({
            challengeId: webData.challengeId,
            initData: miniAppInitData,
            telegramUser: webData.telegramUser,
          });
          setStep('webapp_phone');
          return;
        }
      }

      const res = await fetch('/api/auth/telegram/init', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = (await res.json()) as InitResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || "Kirishni boshlashda xatolik yuz berdi.");
        return;
      }
      setInitData(data);
      setStep(data.botConfigured ? 'bot_wait' : 'preview_bot');
    } catch {
      setError("Server bilan aloqa o'rnatilmadi.");
    } finally {
      setLoading(false);
    }
  }

  function handleDirectRequestContact() {
    const tg = getTelegramWebApp();
    if (!tg?.requestContact || !webAppAuth) {
      setError("Telegram mijozingiz ushbu funksiyani qo'llamaydi. Bot orqali raqam yuborishga o'ting.");
      return;
    }

    setError(null);
    setVerifyingContact(true);

    tg.requestContact((shared, event) => {
      if (!shared) {
        setVerifyingContact(false);
        setError("Kirish uchun o'zingizga tegishli +998 telefon raqamingizni ulashing.");
        return;
      }

      if (event?.response) {
        void (async () => {
          try {
            const res = await fetch('/api/auth/telegram/webapp/contact', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({
                initData: webAppAuth.initData,
                contactResponse: event.response,
                challengeId: webAppAuth.challengeId,
              }),
            });
            const data = (await res.json()) as {
              status?: string;
              token?: string;
              user?: UserProfile;
              error?: string;
            };
            if (res.ok && data.token && data.user) {
              onAuthenticated(data.token, data.user);
            } else if (!res.ok && data.error) {
              setVerifyingContact(false);
              setError(data.error);
            }
          } catch {
            // Polling fallback via activeChallengeId remains active
          }
        })();
      }
    });
  }

  async function handlePreviewVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!initData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/telegram/verify-preview', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          challengeId: initData.challengeId,
          name,
          username,
          phoneNumber,
          isOwnContact,
        }),
      });
      const data = (await res.json()) as { token?: string; user?: UserProfile; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setError(data.error || "Tasdiqlashda xatolik yuz berdi.");
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setError("Server bilan bog'lanishda xatolik.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      {step === 'welcome' && (
        <main className="flex-1 flex flex-col justify-between px-6 py-10">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="mb-6">
              <AppLogo size="lg" />
            </div>

            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Sog'lom Ko'chat
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#707579] max-w-[290px]">
              Ko'chatlar parvarishi va rasm orqali kasalliklarni aniqlash platformasi.
            </p>

            <div className="mt-8 w-full rounded-2xl bg-[#F4F4F5] p-4 text-left space-y-2.5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#3390EC] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#334155] leading-snug">
                  Kirish faqat Telegram bot orqali <span className="font-semibold">+998</span> raqamni tasdiqlash bilan amalga oshiriladi.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#334155] leading-snug">
                  Hisobingizda Telegram ismingiz, rasmingiz va 10 ta bepul tahlil limiti ochiladi.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6">
            {error && (
              <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-center">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleStartTelegramLogin}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 shadow-sm transition-all disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              <span>{loading ? 'Yuklanmoqda...' : 'Telegram orqali kirish'}</span>
            </button>
            <div className="flex justify-center pt-1">
              <PWAInstallCard variant="compact" />
            </div>
          </div>
        </main>
      )}

      {step === 'webapp_phone' && webAppAuth && (
        <main className="flex-1 flex flex-col justify-between px-6 py-10">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="mb-5">
              <AppLogo size="lg" />
            </div>

            <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight">
              Assalomu alaykum, {webAppAuth.telegramUser.name}!
            </h1>
            {webAppAuth.telegramUser.username && (
              <p className="mt-1 text-[13px] font-medium text-[#3390EC]">
                @{webAppAuth.telegramUser.username}
              </p>
            )}

            <p className="mt-3 text-[14px] leading-relaxed text-[#707579] max-w-[300px]">
              Telegram Web App orqali kirishni yakunlash uchun o'zingizning O'zbekiston (<span className="font-semibold text-[#0F172A]">+998</span>) telefon raqamingizni shu yerning o'zida tasdiqlang.
            </p>

            <div className="mt-7 w-full rounded-2xl bg-[#F4F4F5] p-4 text-left space-y-2.5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#3390EC] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#334155] leading-snug">
                  Raqam faqat Telegram ichidagi rasmiy oyna orqali tasdiqlanadi — botga alohida o'tish shart emas.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#334155] leading-snug">
                  Tasdiqlashdan so'ng 10 ta bepul AI tashxis limiti darhol ochiladi.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6">
            {error && (
              <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-center">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleDirectRequestContact}
              disabled={verifyingContact}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
            >
              <Phone className="w-5 h-5" />
              <span>
                {verifyingContact ? 'Raqam tasdiqlanmoqda...' : 'Telefon raqamni tasdiqlash'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('welcome');
              }}
              className="w-full h-10 text-[13px] font-medium text-[#707579] hover:text-[#0F172A]"
            >
              Boshqa usul bilan kirish
            </button>
          </div>
        </main>
      )}

      {step === 'bot_wait' && initData && (
        <main className="flex-1 flex flex-col px-5 py-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E4E4E7]">
            <button
              type="button"
              onClick={() => {
                setStep('welcome');
                setError(null);
              }}
              aria-label="Orqaga"
              className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-[#3390EC] hover:bg-[#F4F4F5]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold text-[#0F172A]">Telegram tasdiqlash</h2>
          </div>

          <div className="flex-1 flex flex-col justify-center py-8 space-y-5">
            <div className="rounded-2xl bg-[#F4F4F5] p-5 space-y-3">
              <p className="text-[15px] font-semibold text-[#0F172A]">
                1. Botga o'ting va Start bosing
              </p>
              <p className="text-[14px] text-[#707579] leading-relaxed">
                <span className="font-medium text-[#0F172A]">@{initData.botUsername}</span> botida <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">/start</span> bosilgach, bot sizdan telefon raqamingizni so'raydi.
              </p>
              <a
                href={initData.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors"
              >
                <span>Telegram botni ochish</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="rounded-2xl border border-[#E4E4E7] p-4 space-y-2">
              <p className="text-[14px] font-medium text-[#0F172A]">
                2. O'zingizning +998 raqamingizni yuboring
              </p>
              <p className="text-[13px] text-[#707579]">
                Tasdiqlash yakunlanishi bilan ushbu sahifa avtomatik ravishda ochiladi.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
          </div>
        </main>
      )}

      {step === 'preview_bot' && initData && (
        <main className="flex-1 flex flex-col bg-[#EFEFF4]">
          <header className="h-14 bg-white border-b border-[#E4E4E7] px-3 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setStep('welcome');
                setError(null);
              }}
              aria-label="Orqaga"
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#3390EC] hover:bg-[#F4F4F5]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AppLogo size="sm" className="w-9 h-9 rounded-full" />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[#0F172A] truncate">
                @{initData.botUsername}
              </h2>
              <p className="text-[12px] text-[#3390EC]">bot</p>
            </div>
          </header>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            <div className="flex justify-end">
              <div className="bg-[#EEFFDE] text-[#0F172A] rounded-2xl rounded-br-sm px-3.5 py-2 shadow-xs max-w-[85%] text-[14px]">
                /start auth_{initData.challengeId.slice(0, 8)}
              </div>
            </div>

            <div className="flex justify-start">
              <div className="bg-white text-[#0F172A] rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-xs max-w-[88%] text-[14px] leading-relaxed">
                Assalomu alaykum! Kirish uchun o'zingizga tegishli O'zbekiston (<span className="font-semibold">+998</span>) telefon raqamingizni yuboring.
              </div>
            </div>

            <form onSubmit={handlePreviewVerify} className="bg-white rounded-2xl p-4 shadow-xs space-y-3.5 mt-2">
              <div>
                <label htmlFor="tg-name" className="block text-[13px] font-medium text-[#0F172A] mb-1">
                  Telegram ismingiz
                </label>
                <input
                  id="tg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: Sardorbek Alimov"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F4F5] text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                />
              </div>

              <div>
                <label htmlFor="tg-username" className="block text-[13px] font-medium text-[#0F172A] mb-1">
                  Username (ixtiyoriy)
                </label>
                <input
                  id="tg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@sardorbek"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F4F5] text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                />
              </div>

              <div>
                <label htmlFor="tg-phone" className="block text-[13px] font-medium text-[#0F172A] mb-1">
                  Telefon raqamingiz (+998)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#707579] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="tg-phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#F4F4F5] text-[14px] tabular-nums text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={isOwnContact}
                  onChange={(e) => setIsOwnContact(e.target.checked)}
                  className="w-4 h-4 accent-[#3390EC] rounded"
                />
                <span className="text-[13px] text-[#334155]">
                  O'zimga tegishli Telegram kontaktni ulashish
                </span>
              </label>

              {error && (
                <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                <Phone className="w-4 h-4" />
                <span>{loading ? 'Tekshirilmoqda...' : 'Telefon raqamni yuborish'}</span>
              </button>
            </form>
          </div>
        </main>
      )}
    </div>
  );
}

import { waitForTelegramWebAppInitData } from './telegramClient';
import type { UserProfile } from '../types';

const TOKEN_STORAGE_KEY = 'sk_auth_token';

interface SessionCallbacks {
  onRecovered?: (token: string | null, user: UserProfile) => void;
  onExpired?: () => void;
}

let sessionCallbacks: SessionCallbacks = {};
let inFlightRecovery: Promise<{ token: string | null; user: UserProfile } | null> | null = null;

export function registerSessionCallbacks(callbacks: SessionCallbacks) {
  sessionCallbacks = callbacks;
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return val && val.trim().length > 10 ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (token && token.trim().length > 10) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors in strict WebViews
  }
}

export function clearStoredAuthToken() {
  setStoredAuthToken(null);
}

export function buildAuthHeaders(
  baseHeaders: Record<string, string> = {},
  explicitToken?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...baseHeaders,
  };
  const resolvedToken = explicitToken || getStoredAuthToken();
  if (resolvedToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }
  return headers;
}

async function attemptSilentRecovery(
  failedWithBearer: boolean,
): Promise<{ token: string | null; user: UserProfile } | null> {
  // 1. If a stale Bearer header failed, first check whether HttpOnly cookie is still valid
  if (failedWithBearer) {
    try {
      const cookieRes = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      if (cookieRes.ok) {
        const cookieData = (await cookieRes.json()) as {
          authenticated?: boolean;
          token?: string | null;
          user?: UserProfile | null;
        };
        if (cookieData.authenticated && cookieData.user) {
          if (cookieData.token) setStoredAuthToken(cookieData.token);
          return { token: cookieData.token ?? null, user: cookieData.user };
        }
      }
    } catch {
      // Continue to Telegram Web App / demo recovery
    }
  }

  // 2. Inside Telegram Mini App, silently re-authenticate via signed initData
  try {
    const initData = await waitForTelegramWebAppInitData(600);
    if (initData) {
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
        };
        if (webData.status === 'verified' && webData.token && webData.user) {
          setStoredAuthToken(webData.token);
          return { token: webData.token, user: webData.user };
        }
      }
    }
  } catch {
    // Ignore recovery error
  }

  // 3. Preserve ?autostart=1 demo sessions across server restarts
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      try {
        const demoRes = await fetch('/api/auth/demo', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (demoRes.ok) {
          const demoData = (await demoRes.json()) as {
            token?: string;
            user?: UserProfile;
          };
          if (demoData.token && demoData.user) {
            setStoredAuthToken(demoData.token);
            return { token: demoData.token, user: demoData.user };
          }
        }
      } catch {
        // Ignore recovery error
      }
    }
  }

  return null;
}

export async function recoverSessionOnce(
  failedWithBearer: boolean,
): Promise<{ token: string | null; user: UserProfile } | null> {
  if (!inFlightRecovery) {
    inFlightRecovery = attemptSilentRecovery(failedWithBearer).finally(() => {
      inFlightRecovery = null;
    });
  }
  const recovered = await inFlightRecovery;
  if (recovered) {
    sessionCallbacks.onRecovered?.(recovered.token, recovered.user);
  }
  return recovered;
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
  explicitToken?: string | null,
): Promise<Response> {
  const initialHeaders = buildAuthHeaders(
    (options.headers as Record<string, string> | undefined) ?? {},
    explicitToken,
  );
  const usedBearer = Boolean(initialHeaders.Authorization || initialHeaders.authorization);

  const firstRes = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: initialHeaders,
  });

  if (firstRes.status !== 401) {
    return firstRes;
  }

  const recovered = await recoverSessionOnce(usedBearer);
  if (recovered) {
    const retryHeaders = buildAuthHeaders(
      (options.headers as Record<string, string> | undefined) ?? {},
      recovered.token,
    );
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: retryHeaders,
    });
  }

  clearStoredAuthToken();
  sessionCallbacks.onExpired?.();
  return firstRes;
}

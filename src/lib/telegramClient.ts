export interface TelegramWebAppContactEvent {
  status?: 'sent' | 'cancelled';
  response?: string;
  responseUnsafe?: {
    auth_date?: string;
    contact?: {
      phone_number?: string;
      user_id?: number;
      first_name?: string;
      last_name?: string;
    };
  };
}

export interface TelegramWebAppInstance {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  platform?: string;
  version?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestContact?: (
    callback: (shared: boolean, event?: TelegramWebAppContactEvent) => void,
  ) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

export function getTelegramWebApp(): TelegramWebAppInstance | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramWebAppInitData(): string | null {
  const tg = getTelegramWebApp();
  const raw = typeof tg?.initData === 'string' ? tg.initData.trim() : '';
  return raw.length > 0 ? raw : null;
}

export async function waitForTelegramWebAppInitData(timeoutMs = 2500): Promise<string | null> {
  const immediate = getTelegramWebAppInitData();
  if (immediate) return immediate;
  if (typeof window === 'undefined') return null;

  const hasMiniAppHash =
    window.location.hash.includes('tgWebAppData=') ||
    window.location.search.includes('tgWebAppData=');
  if (!hasMiniAppHash) return null;

  return new Promise((resolve) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      const ready = getTelegramWebAppInitData();
      if (ready || Date.now() - start >= timeoutMs) {
        window.clearInterval(timer);
        resolve(ready);
      }
    }, 60);
  });
}

export function initTelegramMiniAppShell(): TelegramWebAppInstance | null {
  const tg = getTelegramWebApp();
  if (!tg) return null;
  try {
    tg.ready?.();
    if (tg.initData && tg.initData.trim().length > 0) {
      tg.expand?.();
      tg.setHeaderColor?.('#FFFFFF');
      tg.setBackgroundColor?.('#F4F4F5');
    }
  } catch {
    // Ignore optional styling/expand errors in older WebApp clients
  }
  return tg;
}

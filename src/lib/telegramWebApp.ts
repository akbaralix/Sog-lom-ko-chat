import crypto from 'node:crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface VerifiedInitData {
  authDate: number;
  queryId: string | null;
  user: TelegramWebAppUser;
}

export interface VerifiedContactPayload {
  authDate: number;
  phoneNumber: string;
  userId: number;
  firstName?: string;
  lastName?: string;
}

export function buildTelegramWebAppSecretKey(botToken: string): Buffer {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken.trim()).digest();
}

function verifyWebAppDataSignature(
  rawQueryString: string,
  botToken: string,
): { params: URLSearchParams; authDate: number } | null {
  const cleanRaw = rawQueryString.trim();
  const cleanToken = botToken.trim();
  if (!cleanRaw || !cleanToken) return null;

  const params = new URLSearchParams(cleanRaw);
  const providedHash = (params.get('hash') ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(providedHash)) return null;

  const entries: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push([key, value]);
  }
  if (entries.length === 0) return null;

  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = buildTelegramWebAppSecretKey(cleanToken);
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
    .toLowerCase();

  const a = Buffer.from(providedHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  const authDate = Number(params.get('auth_date') ?? '0');
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return null;
  }

  return { params, authDate };
}

export function verifyTelegramWebAppInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 24 * 60 * 60,
): VerifiedInitData | null {
  const verified = verifyWebAppDataSignature(initData, botToken);
  if (!verified) return null;

  const { params, authDate } = verified;
  if (nowSeconds - authDate > maxAgeSeconds || authDate > nowSeconds + 300) {
    return null;
  }

  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    const parsed = JSON.parse(userRaw) as Partial<TelegramWebAppUser>;
    if (typeof parsed.id !== 'number' || !Number.isFinite(parsed.id) || parsed.id <= 0) {
      return null;
    }
    return {
      authDate,
      queryId: params.get('query_id'),
      user: {
        id: parsed.id,
        first_name: typeof parsed.first_name === 'string' ? parsed.first_name : 'Foydalanuvchi',
        last_name: typeof parsed.last_name === 'string' ? parsed.last_name : undefined,
        username: typeof parsed.username === 'string' ? parsed.username : undefined,
        photo_url: typeof parsed.photo_url === 'string' ? parsed.photo_url : undefined,
      },
    };
  } catch {
    return null;
  }
}

export function verifyTelegramWebAppContactResponse(
  responseStr: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 15 * 60,
): VerifiedContactPayload | null {
  const verified = verifyWebAppDataSignature(responseStr, botToken);
  if (!verified) return null;

  const { params, authDate } = verified;
  if (nowSeconds - authDate > maxAgeSeconds || authDate > nowSeconds + 300) {
    return null;
  }

  const contactRaw = params.get('contact');
  if (!contactRaw) return null;

  try {
    const parsed = JSON.parse(contactRaw) as {
      phone_number?: unknown;
      user_id?: unknown;
      first_name?: unknown;
      last_name?: unknown;
    };
    if (typeof parsed.phone_number !== 'string' || typeof parsed.user_id !== 'number') {
      return null;
    }
    return {
      authDate,
      phoneNumber: parsed.phone_number,
      userId: parsed.user_id,
      firstName: typeof parsed.first_name === 'string' ? parsed.first_name : undefined,
      lastName: typeof parsed.last_name === 'string' ? parsed.last_name : undefined,
    };
  } catch {
    return null;
  }
}

export function resolvePublicWebAppUrl(appUrl?: string | null): string | null {
  const raw = (appUrl ?? '').trim();
  if (!raw || raw.includes('MY_APP_URL')) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

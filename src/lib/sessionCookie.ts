export const SESSION_COOKIE_NAME = 'sk_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 kun

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  const pairs = cookieHeader.split(';');
  for (const rawPair of pairs) {
    const eqIndex = rawPair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = rawPair.slice(0, eqIndex).trim();
    const rawVal = rawPair.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

function getFirstHeaderValue(value: string | string[] | undefined): string {
  if (!value) return '';
  const raw = Array.isArray(value) ? value[0] ?? '' : value;
  return raw.split(',')[0]?.trim() ?? '';
}

export function isHttpsRequest(
  headers: Record<string, string | string[] | undefined>,
  isSecure?: boolean,
): boolean {
  if (isSecure) return true;
  const forwardedProto = getFirstHeaderValue(headers['x-forwarded-proto']).toLowerCase();
  return forwardedProto === 'https';
}

export function buildSessionCookieHeader(token: string, isHttps: boolean): string {
  const encoded = encodeURIComponent(token);
  if (isHttps) {
    return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
}

export function buildClearSessionCookieHeader(isHttps: boolean): string {
  if (isHttps) {
    return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function isTrustedMutationOrigin(params: {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const method = params.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const origin = getFirstHeaderValue(params.headers.origin);
  const expectedHost = (
    getFirstHeaderValue(params.headers['x-forwarded-host']) ||
    getFirstHeaderValue(params.headers.host)
  ).toLowerCase();

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      return Boolean(expectedHost) && originHost === expectedHost;
    } catch {
      return false;
    }
  }

  const requestedWith = getFirstHeaderValue(params.headers['x-requested-with']).toLowerCase();
  const secFetchSite = getFirstHeaderValue(params.headers['sec-fetch-site']).toLowerCase();
  return requestedWith === 'xmlhttprequest' || secFetchSite === 'same-origin';
}

export function isTransientTelegramNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { code?: string; message?: string };
  };
  const code = e.code ?? e.cause?.code ?? '';
  const message = `${e.message ?? ''} ${e.cause?.message ?? ''}`;
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EPIPE' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  ) {
    return true;
  }
  return /ETIMEDOUT|ECONNRESET|EAI_AGAIN|aborted|timeout/i.test(message);
}

export function computeTelegramBackoffMs(consecutiveFailures: number): number {
  const safeFailures = Math.max(1, Math.floor(consecutiveFailures));
  return Math.min(30000, 1500 * 2 ** Math.min(safeFailures - 1, 5));
}

export function isTelegramWebhookConflict(errorCode?: number, description?: string): boolean {
  return errorCode === 409 && typeof description === 'string' && /webhook/i.test(description);
}

export function isTelegramGetUpdatesConflict(errorCode?: number, description?: string): boolean {
  return (
    errorCode === 409 &&
    typeof description === 'string' &&
    /terminated by other getUpdates|other getUpdates request/i.test(description)
  );
}

export function computeTelegramConflictBackoffMs(consecutiveConflicts: number): number {
  const safeConflicts = Math.max(1, Math.floor(consecutiveConflicts));
  return Math.min(120000, 15000 * 2 ** Math.min(safeConflicts - 1, 3));
}

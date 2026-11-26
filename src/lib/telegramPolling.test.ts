import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTelegramBackoffMs,
  computeTelegramConflictBackoffMs,
  isTelegramGetUpdatesConflict,
  isTelegramWebhookConflict,
  isTransientTelegramNetworkError,
} from './telegramPolling.ts';

test('isTransientTelegramNetworkError identifies read ETIMEDOUT and AbortError', () => {
  const fetchErr = new TypeError('fetch failed');
  (fetchErr as TypeError & { cause?: unknown }).cause = Object.assign(
    new Error('read ETIMEDOUT'),
    { code: 'ETIMEDOUT' },
  );
  assert.equal(isTransientTelegramNetworkError(fetchErr), true);

  const abortErr = new DOMException('The operation was aborted', 'AbortError');
  assert.equal(isTransientTelegramNetworkError(abortErr), true);

  assert.equal(isTransientTelegramNetworkError(new Error('Unexpected JSON syntax')), false);
});

test('computeTelegramBackoffMs scales exponentially up to 30 seconds', () => {
  assert.equal(computeTelegramBackoffMs(1), 1500);
  assert.equal(computeTelegramBackoffMs(2), 3000);
  assert.equal(computeTelegramBackoffMs(3), 6000);
  assert.equal(computeTelegramBackoffMs(10), 30000);
});

test('Telegram 409 conflict classifiers distinguish webhook vs concurrent getUpdates conflicts', () => {
  const getUpdatesMsg =
    'Conflict: terminated by other getUpdates request; make sure that only one bot instance is running';
  assert.equal(isTelegramGetUpdatesConflict(409, getUpdatesMsg), true);
  assert.equal(isTelegramWebhookConflict(409, getUpdatesMsg), false);

  const webhookMsg = "Conflict: can't use getUpdates method while webhook is active";
  assert.equal(isTelegramWebhookConflict(409, webhookMsg), true);
  assert.equal(isTelegramGetUpdatesConflict(409, webhookMsg), false);

  assert.equal(isTelegramGetUpdatesConflict(500, getUpdatesMsg), false);
});

test('computeTelegramConflictBackoffMs scales from 15s up to 120s', () => {
  assert.equal(computeTelegramConflictBackoffMs(1), 15000);
  assert.equal(computeTelegramConflictBackoffMs(2), 30000);
  assert.equal(computeTelegramConflictBackoffMs(3), 60000);
  assert.equal(computeTelegramConflictBackoffMs(4), 120000);
  assert.equal(computeTelegramConflictBackoffMs(10), 120000);
});

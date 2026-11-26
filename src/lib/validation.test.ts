import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FREE_SCAN_LIMIT,
  PRO_SCAN_LIMIT,
  applyProUpgrade,
  canPerformScan,
  formatUzbekPhoneDisplay,
  normalizeUzbekPhone,
  validateTelegramContact,
} from './validation';

test('normalizeUzbekPhone accepts valid Uzbek numbers and rejects foreign ones', () => {
  assert.equal(normalizeUzbekPhone('+998 90 123-45-67'), '+998901234567');
  assert.equal(normalizeUzbekPhone('998977770011'), '+998977770011');
  assert.equal(normalizeUzbekPhone('+7 999 123 45 67'), null);
  assert.equal(normalizeUzbekPhone('+14155552671'), null);
  assert.equal(normalizeUzbekPhone('901234567'), null);
  assert.equal(normalizeUzbekPhone('+99890123'), null);
});

test('formatUzbekPhoneDisplay formats E.164 Uzbek numbers cleanly', () => {
  assert.equal(formatUzbekPhoneDisplay('+998901234567'), '+998 90 123 45 67');
});

test('validateTelegramContact enforces own contact and Uzbek phone number', () => {
  const valid = validateTelegramContact({
    phoneNumber: '+998901234567',
    contactUserId: 123456,
    senderUserId: 123456,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.normalizedPhone, '+998901234567');

  const foreign = validateTelegramContact({
    phoneNumber: '+79991112233',
    contactUserId: 123456,
    senderUserId: 123456,
  });
  assert.equal(foreign.ok, false);
  assert.match(foreign.error ?? '', /998/);

  const notOwned = validateTelegramContact({
    phoneNumber: '+998901234567',
    contactUserId: 999999,
    senderUserId: 123456,
  });
  assert.equal(notOwned.ok, false);
  assert.match(notOwned.error ?? '', /o'zingizga tegishli/i);
});

test('scan quota defaults to 10 and Pro upgrade raises limit', () => {
  assert.equal(DEFAULT_FREE_SCAN_LIMIT, 10);
  assert.deepEqual(canPerformScan({ scanLimit: 10, scansUsed: 0 }), {
    allowed: true,
    remaining: 10,
  });
  assert.deepEqual(canPerformScan({ scanLimit: 10, scansUsed: 10 }), {
    allowed: false,
    remaining: 0,
  });

  const upgraded = applyProUpgrade({ plan: 'free', scanLimit: 10, scansUsed: 10 });
  assert.equal(upgraded.plan, 'pro');
  assert.equal(upgraded.scanLimit, PRO_SCAN_LIMIT);
  assert.equal(canPerformScan(upgraded).allowed, true);
});

import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTelegramWebAppSecretKey,
  resolvePublicWebAppUrl,
  verifyTelegramWebAppContactResponse,
  verifyTelegramWebAppInitData,
} from './telegramWebApp';

function signSamplePayload(fields: Record<string, string>, botToken: string): string {
  const entries = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = buildTelegramWebAppSecretKey(botToken);
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

test('verifyTelegramWebAppInitData verifies authentic signed initData and rejects tampering/expiry', () => {
  const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const now = 1_760_000_000;
  const userJson = JSON.stringify({
    id: 55123456,
    first_name: 'Dilshod',
    last_name: 'Tursunov',
    username: 'dilshod_agro',
  });

  const valid = signSamplePayload(
    {
      auth_date: String(now - 30),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: userJson,
    },
    botToken,
  );

  const verified = verifyTelegramWebAppInitData(valid, botToken, now);
  assert.ok(verified);
  assert.equal(verified?.user.id, 55123456);
  assert.equal(verified?.user.first_name, 'Dilshod');
  assert.equal(verified?.user.username, 'dilshod_agro');

  // Tampered user id must fail
  const tampered = valid.replace('55123456', '99999999');
  assert.equal(verifyTelegramWebAppInitData(tampered, botToken, now), null);

  // Wrong bot token must fail
  assert.equal(verifyTelegramWebAppInitData(valid, 'wrong-token', now), null);

  // Expired auth_date (>24h) must fail
  assert.equal(verifyTelegramWebAppInitData(valid, botToken, now + 90_000), null);
});

test('verifyTelegramWebAppContactResponse validates signed requestContact payload', () => {
  const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const now = 1_760_000_000;

  const signedContact = signSamplePayload(
    {
      auth_date: String(now - 5),
      contact: JSON.stringify({
        phone_number: '+998901234567',
        user_id: 55123456,
        first_name: 'Dilshod',
      }),
    },
    botToken,
  );

  const verified = verifyTelegramWebAppContactResponse(signedContact, botToken, now);
  assert.ok(verified);
  assert.equal(verified?.phoneNumber, '+998901234567');
  assert.equal(verified?.userId, 55123456);

  const tampered = signedContact.replace('901234567', '909999999');
  assert.equal(verifyTelegramWebAppContactResponse(tampered, botToken, now), null);
});

test('resolvePublicWebAppUrl allows HTTPS Cloud Run URLs and rejects placeholders or localhost', () => {
  assert.equal(
    resolvePublicWebAppUrl('https://ais-pre-example.asia-southeast1.run.app/'),
    'https://ais-pre-example.asia-southeast1.run.app',
  );
  assert.equal(resolvePublicWebAppUrl('MY_APP_URL'), null);
  assert.equal(resolvePublicWebAppUrl('http://localhost:3000'), null);
  assert.equal(resolvePublicWebAppUrl(''), null);
});

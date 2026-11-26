import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRO_PACKAGES,
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  computeClickSignString,
  formatUzs,
  getProPackage,
  uzsToTiyin,
  verifyClickSignature,
  verifyPaymeBasicAuth,
} from './payments.ts';
import { applyPackageUpgrade } from './validation.ts';

test('PRO_PACKAGES provides profitable 50 and 100 scan tiers in UZS', () => {
  assert.equal(PRO_PACKAGES.length, 2);
  const p50 = getProPackage('pro_50');
  const p100 = getProPackage('pro_100');
  assert.ok(p50 && p100);
  assert.equal(p50.scansAdded, 50);
  assert.equal(p50.priceUzs, 25000);
  assert.equal(p100.scansAdded, 100);
  assert.equal(p100.priceUzs, 45000);
  assert.equal(getProPackage('invalid'), null);
});

test('uzsToTiyin and formatUzs compute exact Uzbek currency outputs', () => {
  assert.equal(uzsToTiyin(25000), 2500000);
  assert.equal(uzsToTiyin(45000), 4500000);
  assert.equal(formatUzs(25000), "25 000 so'm");
  assert.equal(formatUzs(45000), "45 000 so'm");
});

test('buildClickCheckoutUrl generates valid Click shop checkout parameters', () => {
  const url = new URL(
    buildClickCheckoutUrl({
      serviceId: '12345',
      merchantId: '67890',
      amountUzs: 25000,
      orderId: 'ord_abc123',
      returnUrl: 'https://example.com/?payment_order=ord_abc123',
    }),
  );
  assert.equal(url.origin + url.pathname, 'https://my.click.uz/services/pay');
  assert.equal(url.searchParams.get('service_id'), '12345');
  assert.equal(url.searchParams.get('merchant_id'), '67890');
  assert.equal(url.searchParams.get('amount'), '25000');
  assert.equal(url.searchParams.get('transaction_param'), 'ord_abc123');
});

test('buildPaymeCheckoutUrl encodes base64 merchant, order_id, tiyin amount, and callback', () => {
  const url = buildPaymeCheckoutUrl({
    merchantId: 'payme_merch_1',
    amountUzs: 45000,
    orderId: 'ord_xyz',
    returnUrl: 'https://example.com/?payment_order=ord_xyz',
  });
  assert.ok(url.startsWith('https://checkout.paycom.uz/'));
  const b64 = url.replace('https://checkout.paycom.uz/', '');
  const decoded = Buffer.from(b64, 'base64').toString('utf-8');
  assert.equal(
    decoded,
    'm=payme_merch_1;ac.order_id=ord_xyz;a=4500000;c=https://example.com/?payment_order=ord_xyz',
  );
});

test('verifyClickSignature validates MD5 sign_string for Prepare (0) and Complete (1)', () => {
  const secretKey = 'super_click_secret';
  const prepareSig = computeClickSignString({
    clickTransId: '9911',
    serviceId: '12345',
    secretKey,
    merchantTransId: 'ord_1',
    amount: '25000',
    action: '0',
    signTime: '2026-11-26 12:00:00',
  });
  assert.equal(
    verifyClickSignature({
      clickTransId: '9911',
      serviceId: '12345',
      secretKey,
      merchantTransId: 'ord_1',
      amount: '25000',
      action: '0',
      signTime: '2026-11-26 12:00:00',
      signString: prepareSig,
    }),
    true,
  );
  assert.equal(
    verifyClickSignature({
      clickTransId: '9911',
      serviceId: '12345',
      secretKey,
      merchantTransId: 'ord_1',
      amount: '15000',
      action: '0',
      signTime: '2026-11-26 12:00:00',
      signString: prepareSig,
    }),
    false,
  );

  const completeSig = computeClickSignString({
    clickTransId: '9911',
    serviceId: '12345',
    secretKey,
    merchantTransId: 'ord_1',
    merchantPrepareId: 'prep_1',
    amount: '25000',
    action: '1',
    signTime: '2026-11-26 12:01:00',
  });
  assert.equal(
    verifyClickSignature({
      clickTransId: '9911',
      serviceId: '12345',
      secretKey,
      merchantTransId: 'ord_1',
      merchantPrepareId: 'prep_1',
      amount: '25000',
      action: '1',
      signTime: '2026-11-26 12:01:00',
      signString: completeSig,
    }),
    true,
  );
});

test('verifyPaymeBasicAuth validates Paycom:<secret> header safely', () => {
  const validToken = Buffer.from('Paycom:my_payme_key', 'utf-8').toString('base64');
  assert.equal(verifyPaymeBasicAuth(`Basic ${validToken}`, 'my_payme_key'), true);
  assert.equal(verifyPaymeBasicAuth(`Basic ${validToken}`, 'wrong_key'), false);
  assert.equal(verifyPaymeBasicAuth('Bearer abc', 'my_payme_key'), false);
});

test('applyPackageUpgrade adds purchased scan count on top of existing quota', () => {
  const after50 = applyPackageUpgrade({ plan: 'free', scanLimit: 10, scansUsed: 4 }, 50);
  assert.deepEqual(after50, { plan: 'pro', scanLimit: 60, scansUsed: 4 });

  const after100More = applyPackageUpgrade(after50, 100);
  assert.deepEqual(after100More, { plan: 'pro', scanLimit: 160, scansUsed: 4 });
});

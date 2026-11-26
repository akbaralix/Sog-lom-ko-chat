import crypto from 'node:crypto';
import {
  PRO_PACKAGES,
  type ProPackageSpec,
  formatUzs,
  getProPackage,
  uzsToTiyin,
} from './paymentCatalog';

export { PRO_PACKAGES, type ProPackageSpec, formatUzs, getProPackage, uzsToTiyin };

export function buildClickCheckoutUrl(params: {
  serviceId: string;
  merchantId: string;
  amountUzs: number;
  orderId: string;
  returnUrl: string;
}): string {
  const url = new URL('https://my.click.uz/services/pay');
  url.searchParams.set('service_id', params.serviceId);
  url.searchParams.set('merchant_id', params.merchantId);
  url.searchParams.set('amount', String(params.amountUzs));
  url.searchParams.set('transaction_param', params.orderId);
  url.searchParams.set('return_url', params.returnUrl);
  return url.toString();
}

export function buildPaymeCheckoutUrl(params: {
  merchantId: string;
  amountUzs: number;
  orderId: string;
  returnUrl: string;
}): string {
  const payload = [
    `m=${params.merchantId}`,
    `ac.order_id=${params.orderId}`,
    `a=${uzsToTiyin(params.amountUzs)}`,
    `c=${params.returnUrl}`,
  ].join(';');
  const encoded = Buffer.from(payload, 'utf-8').toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

export function computeClickSignString(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  merchantPrepareId?: string;
  amount: string;
  action: string;
  signTime: string;
}): string {
  const preparePart = params.action === '1' ? String(params.merchantPrepareId ?? '') : '';
  const raw =
    `${params.clickTransId}${params.serviceId}${params.secretKey}` +
    `${params.merchantTransId}${preparePart}${params.amount}${params.action}${params.signTime}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

export function verifyClickSignature(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  merchantPrepareId?: string;
  amount: string;
  action: string;
  signTime: string;
  signString: string;
}): boolean {
  if (!params.secretKey || !params.signString) return false;
  const expected = computeClickSignString(params);
  const actual = params.signString.trim().toLowerCase();
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(actual, 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyPaymeBasicAuth(
  authHeader: string | undefined,
  secretKey: string,
): boolean {
  if (!authHeader || !secretKey) return false;
  const match = /^Basic\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  let decoded = '';
  try {
    decoded = Buffer.from(match[1].trim(), 'base64').toString('utf-8');
  } catch {
    return false;
  }
  const expected = `Paycom:${secretKey}`;
  const a = Buffer.from(decoded, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

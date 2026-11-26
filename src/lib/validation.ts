export const DEFAULT_FREE_SCAN_LIMIT = 10;
export const PRO_SCAN_LIMIT = 100;

export interface ContactValidationInput {
  phoneNumber: string;
  contactUserId: number | string;
  senderUserId: number | string;
}

export interface ContactValidationResult {
  ok: boolean;
  normalizedPhone?: string;
  error?: string;
}

export interface QuotaState {
  scanLimit: number;
  scansUsed: number;
  plan: 'free' | 'pro';
}

export function normalizeUzbekPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[\s\-()]/g, '');
  const withoutPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (!/^998\d{9}$/.test(withoutPlus)) {
    return null;
  }
  return `+${withoutPlus}`;
}

export function formatUzbekPhoneDisplay(phone: string): string {
  const normalized = normalizeUzbekPhone(phone);
  if (!normalized) return phone;
  // +998 90 123 45 67
  const digits = normalized.slice(1);
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

export function validateTelegramContact(input: ContactValidationInput): ContactValidationResult {
  const contactId = String(input.contactUserId ?? '').trim();
  const senderId = String(input.senderUserId ?? '').trim();

  if (!contactId || !senderId || contactId !== senderId) {
    return {
      ok: false,
      error: "Faqat o'zingizga tegishli Telegram telefon raqamingizni yuboring.",
    };
  }

  const normalizedPhone = normalizeUzbekPhone(input.phoneNumber);
  if (!normalizedPhone) {
    return {
      ok: false,
      error: "Faqat O'zbekiston (+998) telefon raqamlari qabul qilinadi.",
    };
  }

  return {
    ok: true,
    normalizedPhone,
  };
}

export function canPerformScan(state: Pick<QuotaState, 'scanLimit' | 'scansUsed'>): {
  allowed: boolean;
  remaining: number;
} {
  const remaining = Math.max(0, state.scanLimit - state.scansUsed);
  return {
    allowed: state.scansUsed < state.scanLimit,
    remaining,
  };
}

export function applyProUpgrade(state: QuotaState): QuotaState {
  return {
    ...state,
    plan: 'pro',
    scanLimit: Math.max(state.scanLimit, PRO_SCAN_LIMIT),
  };
}

export function applyPackageUpgrade(state: QuotaState, scansToAdd: number): QuotaState {
  const safeAdd = Math.max(1, Math.floor(Number.isFinite(scansToAdd) ? scansToAdd : 0));
  return {
    ...state,
    plan: 'pro',
    scanLimit: state.scanLimit + safeAdd,
  };
}

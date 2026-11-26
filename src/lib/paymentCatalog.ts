import type { ProPackageId } from '../types';

export interface ProPackageSpec {
  id: ProPackageId;
  name: string;
  scansAdded: number;
  priceUzs: number;
  perScanUzs: number;
  subtitle: string;
  recommended: boolean;
}

/**
 * Unit economics breakdown (UZS):
 * - 1 image scan + low thinking + up to ~15 unlimited Pro AI chat follow-ups ~= 70-130 UZS Gemini cost
 * - Click / Payme merchant acquiring fee ~= 1.5% - 2.0%
 * - Start Pro (50 scans @ 25,000 UZS = 500 UZS/scan) and Agro Pro (100 scans @ 45,000 UZS = 450 UZS/scan)
 *   ensure ~75-85% gross profit margin while remaining highly accessible to Uzbek farmers.
 */
export const PRO_PACKAGES: readonly ProPackageSpec[] = [
  {
    id: 'pro_50',
    name: 'Start Pro',
    scansAdded: 50,
    priceUzs: 25000,
    perScanUzs: 500,
    subtitle: '50 ta rasm tahlili + cheksiz AI agronom suhbati',
    recommended: false,
  },
  {
    id: 'pro_100',
    name: 'Agro Pro',
    scansAdded: 100,
    priceUzs: 45000,
    perScanUzs: 450,
    subtitle: '100 ta rasm tahlili + cheksiz AI agronom suhbati',
    recommended: true,
  },
] as const;

export function getProPackage(packageId: unknown): ProPackageSpec | null {
  if (packageId !== 'pro_50' && packageId !== 'pro_100') return null;
  return PRO_PACKAGES.find((p) => p.id === packageId) ?? null;
}

export function uzsToTiyin(amountUzs: number): number {
  return Math.round(amountUzs * 100);
}

export function formatUzs(amountUzs: number): string {
  const rounded = Math.round(amountUzs);
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

import type { AffectedSpot, RecommendedClass, WeatherRiskReport } from '../types';

export interface UzRegion {
  id: string;
  name: string;
  lat: number;
  lon: number;
  baselineTemp: number;
  baselineHumidity: number;
}

export const UZ_REGIONS: UzRegion[] = [
  { id: 'toshkent', name: 'Toshkent', lat: 41.2995, lon: 69.2401, baselineTemp: 18, baselineHumidity: 62 },
  { id: 'fargona', name: "Farg'ona", lat: 40.3842, lon: 71.7843, baselineTemp: 19, baselineHumidity: 68 },
  { id: 'andijon', name: 'Andijon', lat: 40.7821, lon: 72.3442, baselineTemp: 19, baselineHumidity: 71 },
  { id: 'namangan', name: 'Namangan', lat: 40.9983, lon: 71.6726, baselineTemp: 18, baselineHumidity: 66 },
  { id: 'samarqand', name: 'Samarqand', lat: 39.6542, lon: 66.9597, baselineTemp: 17, baselineHumidity: 58 },
  { id: 'buxoro', name: 'Buxoro', lat: 39.7747, lon: 64.4286, baselineTemp: 21, baselineHumidity: 44 },
  { id: 'qashqadaryo', name: 'Qashqadaryo', lat: 38.8606, lon: 65.7891, baselineTemp: 20, baselineHumidity: 48 },
  { id: 'xorazm', name: 'Xorazm', lat: 41.55, lon: 60.6333, baselineTemp: 16, baselineHumidity: 55 },
];

export interface AgroPreparation {
  id: string;
  name: string;
  activeIngredient: string;
  category: Exclude<RecommendedClass, 'none'>;
  targetDiseases: string[];
  dosePer10L: number;
  unit: 'g' | 'ml';
  waterLitersPerSotix: number;
  waitingPeriodDays: number;
  usageNote: string;
  approxPriceUzs: string;
}

export const AGRO_PREPARATIONS: AgroPreparation[] = [
  {
    id: 'ridomil-gold',
    name: 'Ridomil Gold MC',
    activeIngredient: 'Mankotseb + Mefenoksam',
    category: 'fungicide',
    targetDiseases: ['fitoftoroz', 'fitoftora', 'peronosporoz', 'soxta un shudring', 'dog', 'chirish'],
    dosePer10L: 25,
    unit: 'g',
    waterLitersPerSotix: 5,
    waitingPeriodDays: 14,
    usageNote: "Ertalab yoki kechki salqinda bargning ikki tomoniga purkaladi.",
    approxPriceUzs: "48 000 so'm / 50 g",
  },
  {
    id: 'topaz-100',
    name: 'Topaz 100 EC',
    activeIngredient: 'Penkonazol',
    category: 'fungicide',
    targetDiseases: ['un shudring', 'oq gubor', 'oqqor', 'oidium', 'zang'],
    dosePer10L: 4,
    unit: 'ml',
    waterLitersPerSotix: 6,
    waitingPeriodDays: 14,
    usageNote: "Birinchi oq g'ubor belgilari chiqishi bilan 10 kun oralig'ida sepiladi.",
    approxPriceUzs: "35 000 so'm / 10 ml",
  },
  {
    id: 'aktara-25',
    name: 'Aktara 25 WG',
    activeIngredient: 'Tiametoksam',
    category: 'insecticide',
    targetDiseases: ['shira', 'oq qanot', 'tripsin', 'kolorado', 'zararkunanda', 'qurt', 'bit'],
    dosePer10L: 4,
    unit: 'g',
    waterLitersPerSotix: 5,
    waitingPeriodDays: 14,
    usageNote: "So'ruvchi hasharotlarga qarshi bargdan yoki ildiz ostiga beriladi.",
    approxPriceUzs: "28 000 so'm / 4 g",
  },
  {
    id: 'vertimek',
    name: 'Vertimek 1.8 EC',
    activeIngredient: 'Abamektin',
    category: 'insecticide',
    targetDiseases: ['kana', 'o‘rgimchakkana', 'orgimchakkana', 'trips', 'g‘ovaklovchi'],
    dosePer10L: 8,
    unit: 'ml',
    waterLitersPerSotix: 6,
    waitingPeriodDays: 7,
    usageNote: "Barg ostidagi kana va tripslarga qarshi yaxshi ho'llab purkaladi.",
    approxPriceUzs: "42 000 so'm / 10 ml",
  },
  {
    id: 'bordo-mis',
    name: 'Mis kuporosi (Bordo 1%)',
    activeIngredient: 'Mis sulfat + Ohak',
    category: 'bactericide',
    targetDiseases: ['bakterial', 'bakterioz', 'qora dog', 'chirish', 'saraton'],
    dosePer10L: 100,
    unit: 'g',
    waterLitersPerSotix: 8,
    waitingPeriodDays: 15,
    usageNote: "Yomg'irdan keyin bakterial dog'lanish tarqalishini to'xtatish uchun sepiladi.",
    approxPriceUzs: "22 000 so'm / 200 g",
  },
  {
    id: 'fitosporin-m',
    name: 'Fitosporin-M (Bio)',
    activeIngredient: 'Bacillus subtilis',
    category: 'bactericide',
    targetDiseases: ['ildiz chirishi', 'qora oyoq', 'fuzarioz', 'profilaktika'],
    dosePer10L: 15,
    unit: 'ml',
    waterLitersPerSotix: 5,
    waitingPeriodDays: 1,
    usageNote: "Ekishdan keyin ildiz atrofini va ko'chatni mustahkamlash uchun xavfsiz biopreparat.",
    approxPriceUzs: "25 000 so'm / 200 ml",
  },
  {
    id: 'gumimax-bio',
    name: 'Gumimax + Mikroelementlar',
    activeIngredient: 'Gumin kislotalar + Zn, Fe, Mg',
    category: 'nutrient',
    targetDiseases: ['xloroz', 'ozuq', 'azot', 'sargayish', 'stress', 'zaif', 'yetishmovchilik'],
    dosePer10L: 20,
    unit: 'ml',
    waterLitersPerSotix: 5,
    waitingPeriodDays: 0,
    usageNote: "Barg sarg'ayishi va ko'chat stressini tez tiklash uchun ildizdan va bargdan beriladi.",
    approxPriceUzs: "30 000 so'm / 250 ml",
  },
];

export function matchPreparations(params: {
  healthStatus: 'healthy' | 'diseased' | 'attention';
  recommendedClass?: RecommendedClass;
  diseaseName?: string | null;
  conditionSummary?: string;
}): AgroPreparation[] {
  if (params.healthStatus === 'healthy') {
    return [];
  }

  const haystack = `${params.diseaseName ?? ''} ${params.conditionSummary ?? ''}`.toLowerCase();
  const scored = AGRO_PREPARATIONS.map((prep) => {
    let score = 0;
    if (params.recommendedClass && params.recommendedClass !== 'none' && prep.category === params.recommendedClass) {
      score += 4;
    }
    for (const kw of prep.targetDiseases) {
      if (haystack.includes(kw)) {
        score += 3;
      }
    }
    return { prep, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, 2).map((item) => item.prep);
  }

  if (params.healthStatus === 'attention') {
    return [AGRO_PREPARATIONS[6], AGRO_PREPARATIONS[5]];
  }
  return [AGRO_PREPARATIONS[0], AGRO_PREPARATIONS[5]];
}

export interface DosageCalculation {
  waterLiters: number;
  productAmount: number;
  unit: 'g' | 'ml';
  formattedDose: string;
  formattedWater: string;
}

export function calculateDosage(
  prep: AgroPreparation,
  mode: 'liters' | 'sotix',
  amount: number,
): DosageCalculation {
  const safeAmount = Math.max(0.5, Math.min(500, Number.isFinite(amount) ? amount : 1));
  const waterLiters =
    mode === 'liters'
      ? Math.round(safeAmount * 10) / 10
      : Math.round(safeAmount * prep.waterLitersPerSotix * 10) / 10;

  const rawDose = (waterLiters / 10) * prep.dosePer10L;
  const productAmount = Math.round(rawDose * 10) / 10;

  return {
    waterLiters,
    productAmount,
    unit: prep.unit,
    formattedDose: `${productAmount} ${prep.unit}`,
    formattedWater: `${waterLiters} L suv`,
  };
}

export function normalizeAffectedSpots(
  rawSpots: Array<{
    id?: string;
    label?: string;
    xPercent?: number;
    yPercent?: number;
    severity?: string;
  }> | undefined,
): AffectedSpot[] {
  if (!Array.isArray(rawSpots)) return [];
  const cleaned: AffectedSpot[] = [];

  for (let i = 0; i < rawSpots.length && cleaned.length < 4; i++) {
    const spot = rawSpots[i];
    if (!spot || typeof spot.label !== 'string') continue;
    const label = spot.label.trim();
    if (!label) continue;

    const rawX = Number(spot.xPercent);
    const rawY = Number(spot.yPercent);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;

    const xPercent = Math.round(Math.max(7, Math.min(93, rawX)) * 10) / 10;
    const yPercent = Math.round(Math.max(8, Math.min(92, rawY)) * 10) / 10;

    cleaned.push({
      id: typeof spot.id === 'string' && spot.id.trim() ? spot.id.trim() : `spot_${i + 1}`,
      label: label.slice(0, 48),
      xPercent,
      yPercent,
      severity: spot.severity === 'high' ? 'high' : 'medium',
    });
  }

  return cleaned;
}

export interface ArrowGeometry {
  tipX: number;
  tipY: number;
  tailX: number;
  tailY: number;
  labelAlign: 'left' | 'right';
}

export function computeArrowGeometry(xPercent: number, yPercent: number): ArrowGeometry {
  const tipX = Math.max(7, Math.min(93, xPercent));
  const tipY = Math.max(8, Math.min(92, yPercent));

  const dirX = tipX < 50 ? 1 : -1;
  const dirY = tipY < 50 ? 1 : -1;

  const tailX = Math.max(12, Math.min(88, tipX + dirX * 19));
  const tailY = Math.max(12, Math.min(88, tipY + dirY * 17));

  return {
    tipX,
    tipY,
    tailX,
    tailY,
    labelAlign: dirX > 0 ? 'left' : 'right',
  };
}

export function evaluateWeatherRisk(params: {
  region: UzRegion;
  temperatureC: number;
  humidityPct: number;
  rainProbabilityPct: number;
  communityAlertsCount: number;
  liveSource: boolean;
}): WeatherRiskReport {
  const temp = Math.round(params.temperatureC);
  const humidity = Math.round(params.humidityPct);
  const rain = Math.round(params.rainProbabilityPct);

  let riskLevel: WeatherRiskReport['riskLevel'] = 'low';
  let headline = "Bugun parvarish uchun qulay ob-havo";
  let tip = "Muntazam sug'orish va tuproq yumshatishni davom ettiring.";

  if (humidity >= 75 || (rain >= 55 && temp >= 14 && temp <= 29)) {
    riskLevel = 'high';
    headline = "Zamburug' va fitoftora xavfi yuqori";
    tip = "Kechki sug'orishni to'xtating, issiqxonani shamollating va profilaktik purkashni rejalashtiring.";
  } else if (humidity >= 60 || rain >= 35 || params.communityAlertsCount >= 2) {
    riskLevel = 'medium';
    headline = "Barg dog'lanishiga e'tibor bering";
    tip = "Barglarni nam holda qoldirmang va pastki sarg'aygan barglarni o'z vaqtida tozalang.";
  } else if (temp >= 28 && humidity < 45) {
    riskLevel = 'medium';
    headline = "Quruq havo: o'rgimchakkana xavfi bor";
    tip = "Barg ostini tekshirib turing va tomchilatib sug'orishni ertalabki soatlarga ko'chiring.";
  }

  return {
    regionId: params.region.id,
    regionName: params.region.name,
    temperatureC: temp,
    humidityPct: humidity,
    rainProbabilityPct: rain,
    riskLevel,
    headline,
    tip,
    communityAlertsCount: params.communityAlertsCount,
    liveSource: params.liveSource,
  };
}

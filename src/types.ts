export type AppTab = 'home' | 'camera' | 'profile';

export type RecommendedClass =
  | 'fungicide'
  | 'insecticide'
  | 'bactericide'
  | 'nutrient'
  | 'none';

export interface AffectedSpot {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  severity: 'high' | 'medium';
}

export interface DiagnosisChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

export interface DiagnosisRecord {
  id: string;
  createdAt: string;
  productName: string;
  isPlantOrAgro: boolean;
  healthStatus: 'healthy' | 'diseased' | 'attention';
  conditionSummary: string;
  diseaseName: string | null;
  treatmentSteps: string[];
  preventionTips: string[];
  motivationMessage: string;
  imagePreview?: string;
  affectedSpots?: AffectedSpot[];
  recommendedClass?: RecommendedClass;
  parentDiagnosisId?: string | null;
  chatMessages?: DiagnosisChatMessage[];
}

export interface TreatmentPlan {
  id: string;
  diagnosisId: string;
  productName: string;
  diseaseName: string | null;
  createdAt: string;
  nextCheckAt: string;
  intervalDays: number;
  status: 'active' | 'completed';
  checkInDays: number[];
  followUpDiagnosisId?: string | null;
}

export interface ConsultationRequest {
  id: string;
  diagnosisId: string;
  productName: string;
  diseaseName: string | null;
  note: string;
  createdAt: string;
  status: 'pending' | 'reviewed';
  agronomistName: string;
  agronomistResponse?: string | null;
}

export interface AgroOrder {
  id: string;
  itemType: 'preparation' | 'seedling';
  itemName: string;
  quantityLabel: string;
  region: string;
  phone: string;
  createdAt: string;
  status: 'submitted' | 'confirmed';
}

export type PaymentProvider = 'click' | 'payme';

export type ProPackageId = 'pro_50' | 'pro_100';

export interface PaymentOrder {
  id: string;
  userId: string;
  packageId: ProPackageId;
  packageName: string;
  provider: PaymentProvider;
  amountUzs: number;
  scansAdded: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  paidAt?: string | null;
  providerTransId?: string | null;
  paymeState?: number | null;
  paymeCreateTime?: number | null;
  paymePerformTime?: number | null;
  paymeCancelTime?: number | null;
  paymeCancelReason?: number | null;
}

export interface UserProfile {
  id: string;
  telegramId: number;
  name: string;
  username: string | null;
  phone: string;
  avatarUrl: string | null;
  plan: 'free' | 'pro';
  scanLimit: number;
  scansUsed: number;
  history: DiagnosisRecord[];
  treatmentPlans?: TreatmentPlan[];
  consultations?: ConsultationRequest[];
  orders?: AgroOrder[];
  payments?: PaymentOrder[];
}

export interface WeatherRiskReport {
  regionId: string;
  regionName: string;
  temperatureC: number;
  humidityPct: number;
  rainProbabilityPct: number;
  riskLevel: 'low' | 'medium' | 'high';
  headline: string;
  tip: string;
  communityAlertsCount: number;
  liveSource: boolean;
}

export interface SeedlingDiseaseGuide {
  name: string;
  symptoms: string;
  prevention: string;
}

export interface SeedlingItem {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  image: string;
  season: string;
  temperature: string;
  sunlight: string;
  soil: string;
  watering: string;
  fertilizer: string;
  spacing: string;
  harvest: string;
  overview: string;
  preventionSummary: string[];
  diseases: SeedlingDiseaseGuide[];
}

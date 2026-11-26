import { matchPreparations } from './agroCatalog';
import type { DiagnosisRecord } from '../types';

export const FREE_CHAT_MESSAGES_PER_DIAGNOSIS = 5;
export const MAX_CHAT_MESSAGE_LENGTH = 500;

export function sanitizeChatMessageText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

export function canSendChatMessage(params: {
  plan: 'free' | 'pro';
  userMessageCount: number;
}): { allowed: boolean; remaining: number | null } {
  if (params.plan === 'pro') {
    return { allowed: true, remaining: null };
  }
  const used = Math.max(0, params.userMessageCount);
  const remaining = Math.max(0, FREE_CHAT_MESSAGES_PER_DIAGNOSIS - used);
  return {
    allowed: used < FREE_CHAT_MESSAGES_PER_DIAGNOSIS,
    remaining,
  };
}

export function getQuickChatPrompts(diagnosis: DiagnosisRecord): string[] {
  if (diagnosis.healthStatus === 'healthy') {
    return [
      `${diagnosis.productName} uchun qaysi o'g'itni bersam tezroq rivojlanadi?`,
      "Sug'orish va issiqxona harorati me'yori qanday bo'lsin?",
      "Kasallik tushmasligi uchun profilaktika qachon qilinadi?",
    ];
  }

  return [
    "Arzonroq yoki tabiiy (bio) muqobil dori bormi?",
    "Dorini yomg'irdan oldin yoki kechqurun sepsam bo'ladimi?",
    "Kasallik qo'shni ko'chatlarga o'tmasligi uchun nima qilay?",
  ];
}

export function buildDiagnosisChatContextPrompt(diagnosis: DiagnosisRecord): string {
  const preps = matchPreparations({
    healthStatus: diagnosis.healthStatus,
    recommendedClass: diagnosis.recommendedClass,
    diseaseName: diagnosis.diseaseName,
    conditionSummary: diagnosis.conditionSummary,
  });

  const spotSummary =
    diagnosis.affectedSpots && diagnosis.affectedSpots.length > 0
      ? diagnosis.affectedSpots.map((s, i) => `${i + 1}) ${s.label}`).join('; ')
      : "Yo'q";

  const prepSummary =
    preps.length > 0
      ? preps
          .map(
            (p) =>
              `${p.name} (${p.activeIngredient}, ${p.dosePer10L} ${p.unit}/10L suv, kutish ${p.waitingPeriodDays} kun)`,
          )
          .join('; ')
      : 'Talab etilmaydi';

  return [
    "Siz O'zbekistondagi dehqon va bog'bonlarga yordam beradigan tajribali AI-agronomsiz.",
    "Foydalanuvchi hozirgina tekshirgan ko'chat/mahsulot ma'lumotlari:",
    `- O'simlik/Mahsulot: ${diagnosis.productName}`,
    `- Holat: ${diagnosis.healthStatus}`,
    `- Aniqlangan kasallik/zararkunanda: ${diagnosis.diseaseName || "Aniqlanmadi"}`,
    `- Xulosa: ${diagnosis.conditionSummary}`,
    `- Rasmdagi belgilangan joylar: ${spotSummary}`,
    `- Tavsiya etilgan qadamlar: ${diagnosis.treatmentSteps.join(' | ') || "Yo'q"}`,
    `- Mos mahalliy preparatlar: ${prepSummary}`,
    "Qoidalar:",
    "1. Faqat o'zbek tilida (lotin alifbosida) javob bering.",
    "2. Javob qisqa, amaliy va tushunarli bo'lsin (3-5 jumla yoki qisqa bandlar).",
    "3. Foydalanuvchi savoliga yuqoridagi tashxis va mahalliy O'zbekiston sharoiti/dorilari asosida aniq maslahat bering.",
  ].join('\n');
}

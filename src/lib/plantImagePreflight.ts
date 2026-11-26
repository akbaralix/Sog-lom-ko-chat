export type PreflightRejectCode = 'BLANK_OR_FLAT' | 'DOCUMENT_OR_SCREENSHOT';

export interface CanvasPreflightResult {
  ok: boolean;
  reasonCode?: PreflightRejectCode;
  message?: string;
}

export interface RgbaSampleStats {
  lumaMean: number;
  lumaStdDev: number;
  nearWhiteAndBlackRatio: number;
  colorfulRatio: number;
}

/**
 * Pure pixel analysis on an RGBA buffer (downsampled canvas pixels).
 * Designed to reject ONLY unambiguous non-plant frames (blank/covered lens
 * or monochrome black-on-white documents/screenshots) so flowers, red/yellow
 * fruits, brown stems, and dark soil seedlings are NEVER falsely rejected.
 */
export function analyzeRgbaSample(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
): CanvasPreflightResult {
  const totalPixels = Math.max(1, Math.min(Math.floor(rgba.length / 4), width * height));
  if (totalPixels < 16) {
    return { ok: true };
  }

  let lumaSum = 0;
  let lumaSqSum = 0;
  let nearWhiteOrBlackCount = 0;
  let colorfulCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaSum += luma;
    lumaSqSum += luma * luma;

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;

    if (chroma >= 28) {
      colorfulCount++;
    }

    const isNearWhite = luma >= 225 && chroma <= 24;
    const isNearBlackText = luma <= 70 && chroma <= 24;
    if (isNearWhite || isNearBlackText) {
      nearWhiteOrBlackCount++;
    }
  }

  const lumaMean = lumaSum / totalPixels;
  const variance = Math.max(0, lumaSqSum / totalPixels - lumaMean * lumaMean);
  const lumaStdDev = Math.sqrt(variance);
  const nearWhiteAndBlackRatio = nearWhiteOrBlackCount / totalPixels;
  const colorfulRatio = colorfulCount / totalPixels;

  if (lumaStdDev < 5.5) {
    return {
      ok: false,
      reasonCode: 'BLANK_OR_FLAT',
      message:
        "Rasm juda xira, yopiq yoki bir xil tusda. Iltimos, ko'chat, gul yoki o'simlikni yorug'roq joyda suratga oling — limitingiz saqlab qolindi.",
    };
  }

  if (nearWhiteAndBlackRatio > 0.9 && colorfulRatio < 0.035) {
    return {
      ok: false,
      reasonCode: 'DOCUMENT_OR_SCREENSHOT',
      message:
        "Bu rasm matnli hujjat yoki skrinshotga o'xshaydi. Faqat ko'chat, gul, barg yoki meva-sabzavot rasmini yuboring — limitingiz saqlab qolindi.",
    };
  }

  return { ok: true };
}

/**
 * Downsamples a rendered canvas onto a 64x48 offscreen canvas and runs
 * zero-cost local preflight so blank/document images never consume AI tokens.
 */
export function runCanvasPlantPreflight(sourceCanvas: HTMLCanvasElement): CanvasPreflightResult {
  try {
    const sampleW = 64;
    const sampleH = 48;
    const offscreen = document.createElement('canvas');
    offscreen.width = sampleW;
    offscreen.height = sampleH;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: true };

    ctx.drawImage(sourceCanvas, 0, 0, sampleW, sampleH);
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    return analyzeRgbaSample(imageData.data, sampleW, sampleH);
  } catch {
    return { ok: true };
  }
}

export interface ParsedTopicGateResult {
  isPlantOrAgro: boolean;
  detectedSubjectUz: string | null;
}

export function parseLightTopicGateJson(rawText: string): ParsedTopicGateResult | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned) as {
      isPlantOrAgro?: unknown;
      detectedSubjectUz?: unknown;
    };
    if (typeof parsed.isPlantOrAgro !== 'boolean') {
      return null;
    }
    const subject =
      typeof parsed.detectedSubjectUz === 'string' && parsed.detectedSubjectUz.trim()
        ? parsed.detectedSubjectUz.trim().slice(0, 80)
        : null;

    return {
      isPlantOrAgro: parsed.isPlantOrAgro,
      detectedSubjectUz: subject,
    };
  } catch {
    return null;
  }
}

export function buildOffTopicRejectionMessage(detectedSubject?: string | null): string {
  const cleanSubject =
    typeof detectedSubject === 'string' ? detectedSubject.trim().slice(0, 80) : '';
  if (cleanSubject) {
    return `Rasmda ko'chat, gul yoki o'simlik aniqlanmadi (ko'ringan tasvir: ${cleanSubject}). Iltimos, faqat o'simlik, gul, barg yoki meva-sabzavot rasmini yuboring — tekshiruv limitingiz sarflanmadi.`;
  }
  return "Ushbu rasm ko'chat, gul yoki o'simlik mavzusiga mos kelmadi. Iltimos, faqat o'simlik, barg, gul yoki meva-sabzavot rasmini yuboring — tekshiruv limitingiz sarflanmadi.";
}

export function shouldChargeScanQuota(params: {
  isPlantOrAgro: boolean;
  diagnosisSucceeded: boolean;
}): boolean {
  return Boolean(params.isPlantOrAgro && params.diagnosisSucceeded);
}

export interface TopicGateEvaluation {
  allowed: boolean;
  httpStatus: 200 | 422;
  code: 'OK' | 'OFF_TOPIC_IMAGE';
  shouldChargeQuota: boolean;
  shouldSaveHistory: boolean;
  detectedSubject: string | null;
  message: string | null;
}

export function evaluateTopicGateResponse(params: {
  isPlantOrAgro: boolean;
  detectedSubject?: string | null;
}): TopicGateEvaluation {
  const detectedSubject =
    typeof params.detectedSubject === 'string' && params.detectedSubject.trim()
      ? params.detectedSubject.trim().slice(0, 80)
      : null;

  if (params.isPlantOrAgro) {
    return {
      allowed: true,
      httpStatus: 200,
      code: 'OK',
      shouldChargeQuota: true,
      shouldSaveHistory: true,
      detectedSubject,
      message: null,
    };
  }

  return {
    allowed: false,
    httpStatus: 422,
    code: 'OFF_TOPIC_IMAGE',
    shouldChargeQuota: false,
    shouldSaveHistory: false,
    detectedSubject,
    message: buildOffTopicRejectionMessage(detectedSubject),
  };
}

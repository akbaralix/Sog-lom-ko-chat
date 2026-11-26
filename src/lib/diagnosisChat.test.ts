import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_CHAT_MESSAGES_PER_DIAGNOSIS,
  buildDiagnosisChatContextPrompt,
  canSendChatMessage,
  getQuickChatPrompts,
  sanitizeChatMessageText,
} from './diagnosisChat.ts';
import type { DiagnosisRecord } from '../types.ts';

const sampleDiseased: DiagnosisRecord = {
  id: 'diag_1',
  createdAt: '2026-11-25T10:00:00.000Z',
  productName: "Pomidor ko'chati",
  isPlantOrAgro: true,
  healthStatus: 'diseased',
  recommendedClass: 'fungicide',
  conditionSummary: "Bargda fitoftora belgilari bor.",
  diseaseName: 'Fitoftoroz',
  treatmentSteps: ["Zararlangan bargni oling", "Ridomil Gold MC purkang"],
  preventionTips: ["Issiqxonani shamollating"],
  motivationMessage: "Tezda tuzaladi!",
  affectedSpots: [{ id: 's1', label: "Qo'ng'ir dog'", xPercent: 40, yPercent: 45, severity: 'high' }],
};

test('sanitizeChatMessageText trims whitespace, limits length, and rejects empty input', () => {
  assert.equal(sanitizeChatMessageText('   '), null);
  assert.equal(sanitizeChatMessageText(null), null);
  assert.equal(sanitizeChatMessageText('  Salom   agronom  '), 'Salom agronom');
  const long = 'a'.repeat(600);
  assert.equal(sanitizeChatMessageText(long)?.length, 500);
});

test('canSendChatMessage enforces 5-question free limit per diagnosis and unlimited on Pro', () => {
  assert.deepEqual(canSendChatMessage({ plan: 'free', userMessageCount: 0 }), {
    allowed: true,
    remaining: FREE_CHAT_MESSAGES_PER_DIAGNOSIS,
  });
  assert.deepEqual(canSendChatMessage({ plan: 'free', userMessageCount: 5 }), {
    allowed: false,
    remaining: 0,
  });
  assert.deepEqual(canSendChatMessage({ plan: 'pro', userMessageCount: 50 }), {
    allowed: true,
    remaining: null,
  });
});

test('getQuickChatPrompts returns tailored Uzbek questions for healthy vs diseased diagnoses', () => {
  const diseasedPrompts = getQuickChatPrompts(sampleDiseased);
  assert.equal(diseasedPrompts.length, 3);
  assert.match(diseasedPrompts[0], /dori/i);

  const healthyPrompts = getQuickChatPrompts({
    ...sampleDiseased,
    healthStatus: 'healthy',
    diseaseName: null,
  });
  assert.equal(healthyPrompts.length, 3);
  assert.match(healthyPrompts[0], /Pomidor ko'chati/);
});

test('buildDiagnosisChatContextPrompt embeds plant, disease, spots, and matched local preparation', () => {
  const ctx = buildDiagnosisChatContextPrompt(sampleDiseased);
  assert.match(ctx, /Pomidor ko'chati/);
  assert.match(ctx, /Fitoftoroz/);
  assert.match(ctx, /Qo'ng'ir dog'/);
  assert.match(ctx, /Ridomil Gold MC/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRgbaSample,
  buildOffTopicRejectionMessage,
  evaluateTopicGateResponse,
  parseLightTopicGateJson,
  shouldChargeScanQuota,
} from './plantImagePreflight';

function makeSolidBuffer(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }
  return buf;
}

test('analyzeRgbaSample rejects completely blank or flat frames', () => {
  const darkBlank = makeSolidBuffer(32, 24, 12, 12, 14);
  const res = analyzeRgbaSample(darkBlank, 32, 24);
  assert.equal(res.ok, false);
  assert.equal(res.reasonCode, 'BLANK_OR_FLAT');
});

test('analyzeRgbaSample rejects black-and-white documents / monochrome screenshots', () => {
  const w = 32;
  const h = 24;
  const buf = makeSolidBuffer(w, h, 248, 249, 250);
  // Draw dark gray/black text stripes covering ~15% of pixels
  for (let y = 3; y < 20; y += 4) {
    for (let x = 3; x < 29; x++) {
      const idx = (y * w + x) * 4;
      buf[idx] = 20;
      buf[idx + 1] = 22;
      buf[idx + 2] = 25;
    }
  }
  const res = analyzeRgbaSample(buf, w, h);
  assert.equal(res.ok, false);
  assert.equal(res.reasonCode, 'DOCUMENT_OR_SCREENSHOT');
});

test('analyzeRgbaSample allows colorful seedlings, red tomatoes, and flowers on soil', () => {
  const w = 32;
  const h = 24;
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (y > 16) {
        // Dark brown soil
        buf[idx] = 92;
        buf[idx + 1] = 68;
        buf[idx + 2] = 48;
      } else if (x > 10 && x < 22 && y > 4 && y < 14) {
        // Red tomato / rose petal (non-green!)
        buf[idx] = 210;
        buf[idx + 1] = 48;
        buf[idx + 2] = 52;
      } else {
        // Organic midtone background / foliage
        buf[idx] = 110;
        buf[idx + 1] = 135;
        buf[idx + 2] = 95;
      }
      buf[idx + 3] = 255;
    }
  }
  const res = analyzeRgbaSample(buf, w, h);
  assert.equal(res.ok, true);
});

test('parseLightTopicGateJson parses valid JSON and ignores malformed text cleanly', () => {
  assert.deepEqual(
    parseLightTopicGateJson('```json\n{"isPlantOrAgro": false, "detectedSubjectUz": "avtomobil"}\n```'),
    { isPlantOrAgro: false, detectedSubjectUz: 'avtomobil' },
  );
  assert.deepEqual(
    parseLightTopicGateJson('{"isPlantOrAgro": true, "detectedSubjectUz": "atirgul guli"}'),
    { isPlantOrAgro: true, detectedSubjectUz: 'atirgul guli' },
  );
  assert.equal(parseLightTopicGateJson('not json'), null);
});

test('evaluateTopicGateResponse blocks off-topic images with 422 and zero quota consumption', () => {
  const blocked = evaluateTopicGateResponse({
    isPlantOrAgro: false,
    detectedSubject: 'noutbuk ekrani',
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.httpStatus, 422);
  assert.equal(blocked.code, 'OFF_TOPIC_IMAGE');
  assert.equal(blocked.shouldChargeQuota, false);
  assert.equal(blocked.shouldSaveHistory, false);
  assert.ok(blocked.message?.includes('noutbuk ekrani'));
  assert.ok(blocked.message?.includes('sarflanmadi'));

  const allowed = evaluateTopicGateResponse({ isPlantOrAgro: true, detectedSubject: 'pomidor' });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.shouldChargeQuota, true);
  assert.equal(allowed.shouldSaveHistory, true);
});

test('shouldChargeScanQuota charges quota only when plant/agro AND diagnosis succeeded', () => {
  assert.equal(shouldChargeScanQuota({ isPlantOrAgro: false, diagnosisSucceeded: true }), false);
  assert.equal(shouldChargeScanQuota({ isPlantOrAgro: true, diagnosisSucceeded: false }), false);
  assert.equal(shouldChargeScanQuota({ isPlantOrAgro: true, diagnosisSucceeded: true }), true);
  assert.ok(buildOffTopicRejectionMessage().includes('sarflanmadi'));
});

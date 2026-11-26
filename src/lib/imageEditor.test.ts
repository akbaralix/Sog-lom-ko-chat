import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDIT_STATE,
  clampBrightness,
  clampContrast,
  clampNormalizedPan,
  clampZoom,
  computeCanvasCoverLayout,
  isEdited,
  rotateClockwise,
} from './imageEditor';

test('rotateClockwise cycles through 0, 90, 180, 270', () => {
  assert.equal(rotateClockwise(0), 90);
  assert.equal(rotateClockwise(90), 180);
  assert.equal(rotateClockwise(180), 270);
  assert.equal(rotateClockwise(270), 0);
});

test('clamping functions enforce valid bounds', () => {
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(4), 2.5);
  assert.equal(clampZoom(1.75), 1.75);
  assert.equal(clampNormalizedPan(-3), -1);
  assert.equal(clampNormalizedPan(3), 1);
  assert.equal(clampBrightness(10), 60);
  assert.equal(clampBrightness(200), 150);
  assert.equal(clampContrast(20), 70);
  assert.equal(clampContrast(190), 150);
});

test('isEdited detects modified state accurately', () => {
  assert.equal(isEdited(DEFAULT_EDIT_STATE), false);
  assert.equal(isEdited({ ...DEFAULT_EDIT_STATE, rotation: 90 }), true);
  assert.equal(isEdited({ ...DEFAULT_EDIT_STATE, brightness: 120 }), true);
});

test('computeCanvasCoverLayout covers destination and respects zoom/pan', () => {
  const layout = computeCanvasCoverLayout({
    srcWidth: 1200,
    srcHeight: 900,
    destWidth: 800,
    destHeight: 600,
    edit: { ...DEFAULT_EDIT_STATE, zoom: 2, panX: 1, panY: -1 },
  });
  assert.equal(layout.drawWidth, 1600);
  assert.equal(layout.drawHeight, 1200);
  assert.equal(layout.offsetX, 400);
  assert.equal(layout.offsetY, -300);

  const rotated = computeCanvasCoverLayout({
    srcWidth: 1200,
    srcHeight: 900,
    destWidth: 800,
    destHeight: 600,
    edit: { ...DEFAULT_EDIT_STATE, rotation: 90 },
  });
  // After 90deg rotation, orientedW=900, orientedH=1200 -> baseScale = max(800/900, 600/1200) = 800/900
  assert.ok(Math.abs(rotated.drawWidth - (1200 * 800) / 900) < 0.01);
});

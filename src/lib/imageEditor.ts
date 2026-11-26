export type RotationDeg = 0 | 90 | 180 | 270;

export interface ImageEditState {
  rotation: RotationDeg;
  flipX: boolean;
  zoom: number;
  panX: number; // normalized [-1, 1] relative to max pan range
  panY: number; // normalized [-1, 1] relative to max pan range
  brightness: number; // percentage 60..150, default 100
  contrast: number; // percentage 70..150, default 100
}

export const DEFAULT_EDIT_STATE: ImageEditState = {
  rotation: 0,
  flipX: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
};

export function rotateClockwise(rotation: RotationDeg): RotationDeg {
  return (((rotation + 90) % 360) as RotationDeg);
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(2.5, Math.max(1, Math.round(zoom * 100) / 100));
}

export function clampNormalizedPan(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(-1, value));
}

export function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(150, Math.max(60, Math.round(value)));
}

export function clampContrast(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(150, Math.max(70, Math.round(value)));
}

export function isEdited(state: ImageEditState): boolean {
  return (
    state.rotation !== 0 ||
    state.flipX ||
    state.zoom !== 1 ||
    state.panX !== 0 ||
    state.panY !== 0 ||
    state.brightness !== 100 ||
    state.contrast !== 100
  );
}

export function computeCanvasCoverLayout(params: {
  srcWidth: number;
  srcHeight: number;
  destWidth: number;
  destHeight: number;
  edit: ImageEditState;
}): {
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
} {
  const { srcWidth, srcHeight, destWidth, destHeight, edit } = params;
  const isQuarterTurn = edit.rotation === 90 || edit.rotation === 270;
  const orientedW = isQuarterTurn ? srcHeight : srcWidth;
  const orientedH = isQuarterTurn ? srcWidth : srcHeight;

  const baseScale = Math.max(destWidth / orientedW, destHeight / orientedH);
  const scale = baseScale * clampZoom(edit.zoom);

  const scaledW = orientedW * scale;
  const scaledH = orientedH * scale;

  const maxShiftX = Math.max(0, (scaledW - destWidth) / 2);
  const maxShiftY = Math.max(0, (scaledH - destHeight) / 2);

  const offsetX = clampNormalizedPan(edit.panX) * maxShiftX;
  const offsetY = clampNormalizedPan(edit.panY) * maxShiftY;

  return {
    drawWidth: srcWidth * scale,
    drawHeight: srcHeight * scale,
    offsetX,
    offsetY,
  };
}

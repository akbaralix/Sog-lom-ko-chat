import { useEffect, useRef, useState } from 'react';
import {
  Check,
  FlipHorizontal2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Crop,
  X,
} from 'lucide-react';
import {
  DEFAULT_EDIT_STATE,
  ImageEditState,
  clampBrightness,
  clampContrast,
  clampNormalizedPan,
  clampZoom,
  computeCanvasCoverLayout,
  isEdited,
  rotateClockwise,
} from '../lib/imageEditor';
import { runCanvasPlantPreflight } from '../lib/plantImagePreflight';

interface ImageEditorPanelProps {
  sourceUrl: string;
  onCancel: () => void;
  onConfirm: (editedDataUrl: string, mimeType: 'image/jpeg') => void;
}

const PREVIEW_W = 800;
const PREVIEW_H = 600;

export function ImageEditorPanel({ sourceUrl, onCancel, onConfirm }: ImageEditorPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const [edit, setEdit] = useState<ImageEditState>(DEFAULT_EDIT_STATE);
  const [activeTool, setActiveTool] = useState<'crop' | 'light'>('crop');
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    setImageReady(false);
    setImageError(null);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => {
      setImageError("Rasmni ochib bo'lmadi. Iltimos, JPG yoki PNG rasm tanlang.");
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageReady) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { drawWidth, drawHeight, offsetX, offsetY } = computeCanvasCoverLayout({
      srcWidth: img.naturalWidth || img.width,
      srcHeight: img.naturalHeight || img.height,
      destWidth: PREVIEW_W,
      destHeight: PREVIEW_H,
      edit,
    });

    ctx.save();
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    ctx.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%)`;
    ctx.translate(PREVIEW_W / 2 + offsetX, PREVIEW_H / 2 + offsetY);
    ctx.rotate((edit.rotation * Math.PI) / 180);
    ctx.scale(edit.flipX ? -1 : 1, 1);

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
    setImageError(null);
  }, [edit, imageReady]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (edit.zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: edit.panX,
      panY: edit.panY,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dx = ((e.clientX - drag.startX) / rect.width) * 2;
    const dy = ((e.clientY - drag.startY) / rect.height) * 2;
    setEdit((prev) => ({
      ...prev,
      panX: clampNormalizedPan(drag.panX + dx),
      panY: clampNormalizedPan(drag.panY + dy),
    }));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }
      dragRef.current = null;
    }
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preflight = runCanvasPlantPreflight(canvas);
    if (!preflight.ok) {
      setImageError(
        preflight.message ||
          "Iltimos, faqat ko'chat, gul, barg yoki o'simlik rasmini yuboring — limitingiz saqlab qolindi.",
      );
      return;
    }
    const editedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onConfirm(editedDataUrl, 'image/jpeg');
  }

  const modified = isEdited(edit);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E4E7]/80 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E4E4E7]/70 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Tahrirlashni bekor qilish"
          className="min-h-[40px] px-2 -ml-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#707579] hover:text-[#0F172A]"
        >
          <X className="w-4 h-4" />
          <span>Bekor</span>
        </button>

        <span className="text-[14px] font-semibold text-[#0F172A]">Rasmni tahrirlash</span>

        <button
          type="button"
          onClick={() => setEdit(DEFAULT_EDIT_STATE)}
          disabled={!modified}
          className="min-h-[40px] px-2 -mr-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#3390EC] disabled:text-[#94A3B8]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Asl</span>
        </button>
      </div>

      <div className="relative w-full aspect-[4/3] bg-[#0F172A] overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={PREVIEW_W}
          height={PREVIEW_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-testid="image-editor-canvas"
          className={`w-full h-full block touch-none ${
            edit.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          }`}
        />

        {/* Subtle rule-of-thirds crop guide */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
          <div className="border-r border-b border-white/60" />
          <div className="border-r border-b border-white/60" />
          <div className="border-b border-white/60" />
          <div className="border-r border-b border-white/60" />
          <div className="border-r border-b border-white/60" />
          <div className="border-b border-white/60" />
          <div className="border-r border-white/60" />
          <div className="border-r border-white/60" />
          <div />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div role="tablist" aria-label="Tahrirlash asboblari" className="grid grid-cols-2 gap-1 p-1 bg-[#F4F4F5] rounded-xl">
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'crop'}
            onClick={() => setActiveTool('crop')}
            className={`h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 ${
              activeTool === 'crop'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'bg-transparent text-[#707579] hover:text-[#0F172A]'
            }`}
          >
            <Crop className="w-4 h-4" />
            <span>Kesish va burish</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'light'}
            onClick={() => setActiveTool('light')}
            className={`h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 ${
              activeTool === 'light'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'bg-transparent text-[#707579] hover:text-[#0F172A]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Yorug'lik</span>
          </button>
        </div>

        {activeTool === 'crop' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setEdit((prev) => ({
                    ...prev,
                    rotation: rotateClockwise(prev.rotation),
                  }))
                }
                className="h-11 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7]/70 text-[#0F172A] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCw className="w-4 h-4 text-[#3390EC]" />
                <span>Aylantirish ({edit.rotation}°)</span>
              </button>

              <button
                type="button"
                onClick={() => setEdit((prev) => ({ ...prev, flipX: !prev.flipX }))}
                aria-pressed={edit.flipX}
                className={`h-11 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-colors ${
                  edit.flipX
                    ? 'bg-[#3390EC]/12 text-[#3390EC]'
                    : 'bg-[#F4F4F5] hover:bg-[#E4E4E7]/70 text-[#0F172A]'
                }`}
              >
                <FlipHorizontal2 className="w-4 h-4" />
                <span>Aks ettirish</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <label htmlFor="editor-zoom" className="font-medium text-[#0F172A]">
                  Yaqinlashtirish
                </label>
                <span className="text-[#3390EC] font-medium tabular-nums">
                  {edit.zoom.toFixed(1)}x
                </span>
              </div>
              <input
                id="editor-zoom"
                type="range"
                min={1}
                max={2.5}
                step={0.1}
                value={edit.zoom}
                onChange={(e) => {
                  const nextZoom = clampZoom(Number(e.target.value));
                  setEdit((prev) => ({
                    ...prev,
                    zoom: nextZoom,
                    panX: nextZoom === 1 ? 0 : prev.panX,
                    panY: nextZoom === 1 ? 0 : prev.panY,
                  }));
                }}
                className="w-full accent-[#3390EC] h-2 cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <label htmlFor="editor-brightness" className="font-medium text-[#0F172A]">
                  Yorqinlik
                </label>
                <span className="text-[#3390EC] font-medium tabular-nums">
                  {edit.brightness}%
                </span>
              </div>
              <input
                id="editor-brightness"
                type="range"
                min={60}
                max={150}
                step={5}
                value={edit.brightness}
                onChange={(e) =>
                  setEdit((prev) => ({
                    ...prev,
                    brightness: clampBrightness(Number(e.target.value)),
                  }))
                }
                className="w-full accent-[#3390EC] h-2 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <label htmlFor="editor-contrast" className="font-medium text-[#0F172A]">
                  Kontrast
                </label>
                <span className="text-[#3390EC] font-medium tabular-nums">
                  {edit.contrast}%
                </span>
              </div>
              <input
                id="editor-contrast"
                type="range"
                min={70}
                max={150}
                step={5}
                value={edit.contrast}
                onChange={(e) =>
                  setEdit((prev) => ({
                    ...prev,
                    contrast: clampContrast(Number(e.target.value)),
                  }))
                }
                className="w-full accent-[#3390EC] h-2 cursor-pointer"
              />
            </div>
          </div>
        )}

        {imageError && (
          <p role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {imageError}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!imageReady}
          className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        >
          <Check className="w-5 h-5" />
          <span>AI bilan tahlil qilish</span>
        </button>
      </div>
    </div>
  );
}

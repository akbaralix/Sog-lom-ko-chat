import { useRef, useState } from 'react';
import {
  Camera,
  Crown,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  X,
} from 'lucide-react';
import type { DiagnosisRecord, UserProfile } from '../types';
import { AnnotatedDiagnosisImage } from './AnnotatedDiagnosisImage';
import { DiagnosisResultView } from './DiagnosisResultView';
import { ImageEditorPanel } from './ImageEditorPanel';

interface DiagnoseScreenProps {
  token?: string | null;
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onOpenProUpgrade: () => void;
  followUpTarget?: DiagnosisRecord | null;
  onClearFollowUp?: () => void;
}

export function DiagnoseScreen({
  token,
  user,
  onUserUpdated,
  onOpenProUpgrade,
  followUpTarget = null,
  onClearFollowUp,
}: DiagnoseScreenProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [rawSourceUrl, setRawSourceUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offTopicNotice, setOffTopicNotice] = useState<{
    message: string;
    detectedSubject?: string | null;
  } | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [result, setResult] = useState<DiagnosisRecord | null>(null);

  const remaining = Math.max(0, user.scanLimit - user.scansUsed);

  async function analyzeDataUrl(dataUrl: string, mimeType: string) {
    setEditing(false);
    setPreviewUrl(dataUrl);
    setAnalyzing(true);
    setError(null);
    setOffTopicNotice(null);
    setLimitReached(false);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const base64 = dataUrl.split(',')[1] ?? '';
      if (base64.length < 50) {
        setError("Rasmni tayyorlashda xatolik yuz berdi. Boshqa rasm tanlang.");
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          parentDiagnosisId: followUpTarget?.id ?? null,
        }),
        signal: controller.signal,
      });

      const rawText = await res.text();
      let data: {
        diagnosis?: DiagnosisRecord;
        user?: UserProfile;
        error?: string;
        code?: string;
        detectedSubject?: string | null;
      } = {};

      if (rawText) {
        try {
          data = JSON.parse(rawText) as typeof data;
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        if (data.code === 'OFF_TOPIC_IMAGE') {
          setOffTopicNotice({
            message:
              data.error ||
              "Ushbu rasm ko'chat, gul yoki o'simlik mavzusiga mos kelmadi. Limitingiz sarflanmadi.",
            detectedSubject: data.detectedSubject ?? null,
          });
          return;
        }
        if (data.code === 'LIMIT_REACHED') {
          setLimitReached(true);
        }
        if (data.error) {
          setError(data.error);
        } else if (res.status === 401) {
          setError("Sessiya muddati tugagan. Iltimos, hisobingizdan chiqib qayta kiring.");
        } else if (res.status === 413) {
          setError("Rasm hajmi juda katta. Qayta tahrirlab kichikroq rasm yuboring.");
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          setError("AI xizmati hozir band. Bir necha soniyadan so'ng qayta urinib ko'ring.");
        } else {
          setError(`Tahlil qilishda xatolik (${res.status}). Qayta urinib ko'ring.`);
        }
        return;
      }

      if (data.diagnosis && data.user) {
        setResult(data.diagnosis);
        onUserUpdated(data.user);
      } else if (rawText.trim().startsWith('<')) {
        setError("Sessiya yangilanishi kerak. Sahifani yangilab qayta urinib ko'ring.");
      } else {
        setError("Serverdan kutilmagan javob keldi. Qayta urinib ko'ring.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError("Tahlil vaqti tugadi. Iltimos, qayta urinib ko'ring.");
      } else {
        setError("Internet yoki server bilan bog'lanishda xatolik yuz berdi.");
      }
    } finally {
      clearTimeout(timeoutId);
      setAnalyzing(false);
    }
  }

  function openEditorForUrl(dataUrl: string) {
    setRawSourceUrl(dataUrl);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setOffTopicNotice(null);
    setLimitReached(false);
    setEditing(true);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        openEditorForUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleTestSample() {
    try {
      const res = await fetch('/src/assets/images/seedling_tomato_1795607604110.jpg');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          openEditorForUrl(reader.result);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setError("Namuna rasmni yuklab bo'lmadi.");
    }
  }

  function handleReset() {
    setRawSourceUrl(null);
    setEditing(false);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setOffTopicNotice(null);
    setLimitReached(false);
    onClearFollowUp?.();
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F4F4F5] pb-28">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E4E4E7] px-4 flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-[#0F172A]">Agro Tashxis</h1>
        <span className="text-[13px] font-medium text-[#3390EC] tabular-nums">
          Limit: {remaining} / {user.scanLimit}
        </span>
      </header>

      <main className="p-4 space-y-4">
        {followUpTarget && (
          <div className="bg-white rounded-2xl border border-[#3390EC]/30 px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#3390EC]">Qayta tekshiruv rejimi</p>
              <p className="text-[13px] text-[#0F172A] truncate">
                {followUpTarget.productName} — yangi rasm yuklang
              </p>
            </div>
            {onClearFollowUp && (
              <button
                type="button"
                onClick={onClearFollowUp}
                aria-label="Qayta tekshiruvni bekor qilish"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#707579] hover:bg-[#F4F4F5] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
          aria-label="Kamera orqali rasm olish"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelected}
          className="hidden"
          aria-label="Galereyadan rasm tanlash"
        />

        {!editing && !previewUrl && (
          <div className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-5 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#3390EC]/10 text-[#3390EC] flex items-center justify-center">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-[17px] font-semibold text-[#0F172A]">
                Ko'chat yoki mahsulotni rasmga oling
              </h2>
              <p className="text-[13px] text-[#707579] leading-relaxed">
                AI zararlangan joyni strelka bilan belgilaydi va mahalliy dori dozasini hisoblab beradi.
              </p>
            </div>

            {remaining === 0 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2.5">
                <p className="text-[13px] text-amber-900 font-medium">
                  Bepul tahlil limitingiz tugadi.
                </p>
                <button
                  type="button"
                  onClick={onOpenProUpgrade}
                  className="w-full h-11 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[14px] flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  <span>Pro versiyaga o'tish</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  <span>Kameradan rasmga olish</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full h-11 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7]/70 text-[#0F172A] font-medium text-[14px] flex items-center justify-center gap-2 transition-colors"
                >
                  <ImagePlus className="w-4 h-4 text-[#3390EC]" />
                  <span>Galereyadan rasm tanlash</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestSample}
                  className="w-full py-2 text-[13px] font-medium text-[#3390EC] hover:underline"
                >
                  Namuna ko'chat rasmini tekshirib ko'rish
                </button>
              </div>
            )}
          </div>
        )}

        {editing && rawSourceUrl && (
          <ImageEditorPanel
            sourceUrl={rawSourceUrl}
            onCancel={handleReset}
            onConfirm={(editedDataUrl, mimeType) => {
              void analyzeDataUrl(editedDataUrl, mimeType);
            }}
          />
        )}

        {!editing && previewUrl && (
          <div className="space-y-3">
            {result && !analyzing ? (
              <AnnotatedDiagnosisImage
                imageUrl={previewUrl}
                alt={result.productName}
                spots={result.affectedSpots}
              />
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden border border-[#E4E4E7]/80">
                <div className="w-full aspect-[4/3] bg-[#E8ECEF] relative overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Tekshirilayotgan ko'chat rasmi"
                    className="w-full h-full object-cover"
                  />

                  {analyzing && (
                    <div
                      data-testid="ai-scan-overlay"
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#3390EC]/30 via-[#06B6D4]/25 to-[#10B981]/30 animate-ai-glow" />
                      <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent animate-ai-shimmer" />
                      <div className="absolute inset-x-0 top-0 h-16 animate-ai-sweep">
                        <div className="h-full w-full bg-gradient-to-b from-transparent via-[#38BDF8]/40 to-transparent" />
                        <div className="h-[3px] w-full bg-gradient-to-r from-[#3390EC] via-[#22D3EE] to-[#34D399] shadow-[0_0_18px_rgba(34,211,238,0.95)]" />
                      </div>
                      <div className="absolute inset-3 rounded-xl border border-cyan-300/60 shadow-[inset_0_0_18px_rgba(51,144,236,0.35)] animate-ai-glow" />
                    </div>
                  )}
                </div>

                {analyzing && (
                  <div className="p-4 flex items-center justify-center gap-3 text-[#3390EC] bg-gradient-to-r from-[#3390EC]/5 via-cyan-500/8 to-emerald-500/5">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span className="text-[14px] font-semibold">
                      Gemini AI rasmni tahlil qilmoqda...
                    </span>
                  </div>
                )}

                {offTopicNotice && !analyzing && (
                  <div className="p-4 space-y-3" data-testid="off-topic-notice">
                    <div className="rounded-xl bg-amber-50/90 border border-amber-200 px-3.5 py-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 font-semibold text-[13px]">
                        <Sprout className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Mavzudan tashqari rasm aniqlandi</span>
                      </div>
                      <p className="text-[13px] text-amber-900/90 leading-relaxed">
                        {offTopicNotice.message}
                      </p>
                      <div className="pt-1 flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span className="tabular-nums">
                          Limit saqlandi: {remaining} / {user.scanLimit}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (rawSourceUrl) openEditorForUrl(rawSourceUrl);
                        }}
                        className="h-11 rounded-xl bg-[#F4F4F5] text-[#0F172A] font-medium text-[14px] flex items-center justify-center gap-1.5"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-[#3390EC]" />
                        <span>Qayta kesish</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="h-11 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-medium text-[14px] flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Boshqa rasm</span>
                      </button>
                    </div>
                  </div>
                )}

                {error && !offTopicNotice && !analyzing && (
                  <div className="p-4 space-y-3">
                    <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                      {error}
                    </p>
                    {limitReached && (
                      <button
                        type="button"
                        onClick={onOpenProUpgrade}
                        className="w-full h-11 rounded-xl bg-[#3390EC] text-white font-semibold text-[14px]"
                      >
                        Pro versiyaga o'tish
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (rawSourceUrl) openEditorForUrl(rawSourceUrl);
                        }}
                        className="h-11 rounded-xl bg-[#F4F4F5] text-[#0F172A] font-medium text-[14px] flex items-center justify-center gap-1.5"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-[#3390EC]" />
                        <span>Qayta tahrirlash</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="h-11 rounded-xl bg-[#F4F4F5] text-[#0F172A] font-medium text-[14px] flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Boshqa rasm</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result && !analyzing && (
              <div className="space-y-3">
                <DiagnosisResultView
                  result={result}
                  previousDiagnosis={followUpTarget}
                  token={token}
                  user={user}
                  onUserUpdated={onUserUpdated}
                  onDiagnosisUpdated={setResult}
                  onOpenProUpgrade={onOpenProUpgrade}
                />

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[14px] flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Yana rasm tekshirish</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

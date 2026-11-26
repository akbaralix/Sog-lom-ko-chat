import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calculator,
  CheckCircle2,
  FlaskConical,
  HeartHandshake,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
} from 'lucide-react';
import { calculateDosage, matchPreparations } from '../lib/agroCatalog';
import type { DiagnosisRecord, UserProfile } from '../types';
import { DiagnosisChatSection } from './DiagnosisChatSection';
import { OrderSheetModal } from './OrderSheetModal';

interface DiagnosisResultViewProps {
  result: DiagnosisRecord;
  previousDiagnosis?: DiagnosisRecord | null;
  token?: string | null;
  user?: UserProfile;
  onUserUpdated?: (user: UserProfile) => void;
  onDiagnosisUpdated?: (diagnosis: DiagnosisRecord) => void;
  onOpenProUpgrade?: () => void;
}

export function DiagnosisResultView({
  result,
  previousDiagnosis = null,
  token,
  user,
  onUserUpdated,
  onDiagnosisUpdated,
  onOpenProUpgrade,
}: DiagnosisResultViewProps) {
  const matchedPreps = matchPreparations({
    healthStatus: result.healthStatus,
    recommendedClass: result.recommendedClass,
    diseaseName: result.diseaseName,
    conditionSummary: result.conditionSummary,
  });

  const [selectedPrepIdx, setSelectedPrepIdx] = useState(0);
  const [doseMode, setDoseMode] = useState<'liters' | 'sotix'>('liters');
  const [doseAmount, setDoseAmount] = useState<number>(10);

  const [startingPlan, setStartingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [consultOpen, setConsultOpen] = useState(false);
  const [consultNote, setConsultNote] = useState('');
  const [sendingConsult, setSendingConsult] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);

  const [orderOpen, setOrderOpen] = useState(false);

  const activePrep = matchedPreps[selectedPrepIdx] ?? matchedPreps[0] ?? null;
  const dosage = activePrep ? calculateDosage(activePrep, doseMode, doseAmount) : null;

  const activePlan = (user?.treatmentPlans ?? []).find(
    (p) => p.diagnosisId === result.id && p.status === 'active',
  );
  const existingConsult = (user?.consultations ?? []).find(
    (c) => c.diagnosisId === result.id,
  );

  async function handleStartTreatmentPlan() {
    if (!onUserUpdated) return;
    setStartingPlan(true);
    setPlanError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/treatments/start', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ diagnosisId: result.id }),
      });
      const data = (await res.json()) as { user?: UserProfile; error?: string };
      if (!res.ok || !data.user) {
        setPlanError(data.error || "Eslatmani yoqishda xatolik.");
        return;
      }
      onUserUpdated(data.user);
    } catch {
      setPlanError("Server bilan aloqa o'rnatilmadi.");
    } finally {
      setStartingPlan(false);
    }
  }

  async function handleSendConsultation(e: React.FormEvent) {
    e.preventDefault();
    if (!onUserUpdated) return;
    setSendingConsult(true);
    setConsultError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/consultations', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          diagnosisId: result.id,
          note: consultNote,
        }),
      });
      const data = (await res.json()) as { user?: UserProfile; error?: string };
      if (!res.ok || !data.user) {
        setConsultError(data.error || "So'rov yuborishda xatolik.");
        return;
      }
      onUserUpdated(data.user);
      setConsultOpen(false);
      setConsultNote('');
    } catch {
      setConsultError("Server bilan aloqa o'rnatilmadi.");
    } finally {
      setSendingConsult(false);
    }
  }

  const statusLabel = (s: DiagnosisRecord['healthStatus']) =>
    s === 'healthy' ? "Sog'lom" : s === 'attention' ? "E'tibor kerak" : 'Kasallik';

  return (
    <div className="space-y-3">
      {previousDiagnosis && (
        <section className="bg-white rounded-2xl border border-[#3390EC]/30 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Oldin va Keyin taqqoslash
            </h3>
            <span className="text-[12px] font-medium text-[#3390EC]">Qayta tekshiruv</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-[#F4F4F5] p-3">
            <div className="min-w-0">
              <p className="text-[11px] text-[#707579]">Avvalgi holat</p>
              <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                {statusLabel(previousDiagnosis.healthStatus)}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#3390EC] shrink-0" />
            <div className="min-w-0 text-right">
              <p className="text-[11px] text-[#707579]">Hozirgi holat</p>
              <p
                className={`text-[13px] font-semibold truncate ${
                  result.healthStatus === 'healthy' ? 'text-emerald-600' : 'text-[#0F172A]'
                }`}
              >
                {statusLabel(result.healthStatus)}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-[#0F172A]">
              {result.productName}
            </h2>
            {result.diseaseName && (
              <p className="text-[13px] font-medium text-red-600 mt-0.5">
                {result.diseaseName}
              </p>
            )}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg shrink-0 ${
              result.healthStatus === 'healthy'
                ? 'bg-emerald-50 text-emerald-700'
                : result.healthStatus === 'attention'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            {result.healthStatus === 'healthy' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sog'lom</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {result.healthStatus === 'attention' ? "E'tibor kerak" : 'Kasallik'}
                </span>
              </>
            )}
          </div>
        </div>

        <p className="text-[14px] text-[#334155] leading-relaxed">
          {result.conditionSummary}
        </p>
      </section>

      {result.treatmentSteps.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 space-y-2.5">
          <h3 className="text-[15px] font-semibold text-[#0F172A]">
            Nima qilish kerak?
          </h3>
          <ul className="space-y-2">
            {result.treatmentSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#334155] leading-snug">
                <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activePrep && dosage && (
        <section
          aria-label="Mahalliy preparat va doza kalkulyatori"
          className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#3390EC]" />
              <h3 className="text-[15px] font-semibold text-[#0F172A]">
                Mahalliy dori va aniq doza
              </h3>
            </div>
            <span className="text-[12px] text-[#707579] tabular-nums">
              Kutish: {activePrep.waitingPeriodDays} kun
            </span>
          </div>

          {matchedPreps.length > 1 && (
            <div className="grid grid-cols-2 gap-1.5 bg-[#F4F4F5] p-1 rounded-xl">
              {matchedPreps.map((prep, idx) => (
                <button
                  key={prep.id}
                  type="button"
                  onClick={() => setSelectedPrepIdx(idx)}
                  className={`py-2 px-2.5 rounded-lg text-[12px] font-semibold truncate transition-colors ${
                    selectedPrepIdx === idx
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#707579]'
                  }`}
                >
                  {prep.name}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-[#F4F4F5] p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-[#0F172A]">{activePrep.name}</p>
              <p className="text-[12px] font-medium text-[#3390EC] tabular-nums">
                {activePrep.approxPriceUzs}
              </p>
            </div>
            <p className="text-[12px] text-[#707579]">
              Faol modda: {activePrep.activeIngredient}
            </p>
            <p className="text-[12px] text-[#334155] leading-snug pt-0.5">
              {activePrep.usageNote}
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#0F172A]">
              <Calculator className="w-4 h-4 text-[#3390EC]" />
              <span>Doza kalkulyatori</span>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-[#F4F4F5] p-1 rounded-xl text-[12px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setDoseMode('liters');
                  setDoseAmount(10);
                }}
                className={`py-1.5 px-2 rounded-lg whitespace-nowrap transition-colors ${
                  doseMode === 'liters' ? 'bg-white text-[#3390EC] shadow-xs' : 'text-[#707579]'
                }`}
              >
                Litr (chelak)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDoseMode('sotix');
                  setDoseAmount(2);
                }}
                className={`py-1.5 px-2 rounded-lg whitespace-nowrap transition-colors ${
                  doseMode === 'sotix' ? 'bg-white text-[#3390EC] shadow-xs' : 'text-[#707579]'
                }`}
              >
                Maydon (sotix)
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(doseMode === 'liters' ? [5, 10, 20] : [1, 5, 10]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDoseAmount(preset)}
                  className={`px-3 h-9 rounded-xl text-[13px] font-medium tabular-nums border transition-colors ${
                    doseAmount === preset
                      ? 'bg-[#3390EC]/10 border-[#3390EC] text-[#3390EC]'
                      : 'bg-white border-[#E4E4E7] text-[#334155]'
                  }`}
                >
                  {preset} {doseMode === 'liters' ? 'L' : 'sotix'}
                </button>
              ))}
              <input
                type="number"
                min={0.5}
                max={500}
                step={0.5}
                aria-label={doseMode === 'liters' ? 'Suv miqdari litrda' : 'Maydon sotixda'}
                value={doseAmount}
                onChange={(e) => setDoseAmount(Math.max(0.5, Number(e.target.value) || 0.5))}
                className="w-20 h-9 px-2.5 rounded-xl bg-[#F4F4F5] text-[13px] font-semibold text-[#0F172A] tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
              />
            </div>

            <div className="rounded-xl bg-[#3390EC]/8 border border-[#3390EC]/20 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#707579]">Kerakli preparat</p>
                <p data-testid="calculated-dose" className="text-[16px] font-bold text-[#3390EC] tabular-nums">
                  {dosage.formattedDose}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#707579]">Suv hajmi</p>
                <p className="text-[14px] font-semibold text-[#0F172A] tabular-nums">
                  {dosage.formattedWater}
                </p>
              </div>
            </div>
          </div>

          {user && onUserUpdated && (
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="w-full h-11 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7]/70 text-[#0F172A] font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-[#3390EC]" />
              <span>Hamkor agro-do'kondan buyurtma</span>
            </button>
          )}
        </section>
      )}

      {user && onUserUpdated && result.healthStatus !== 'healthy' && (
        <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70 overflow-hidden">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#3390EC]" />
                <h3 className="text-[14px] font-semibold text-[#0F172A]">
                  Davolash nazorati (Telegram)
                </h3>
              </div>
            </div>
            <p className="text-[13px] text-[#707579] leading-snug">
              3 va 7 kundan keyin qayta rasm olib, tuzalishni oldingi natija bilan solishtiring.
            </p>
            {planError && (
              <p className="text-[12px] text-red-600">{planError}</p>
            )}
            {activePlan ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-[13px] font-medium text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Telegram eslatma yoqilgan (3 va 7 kun)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartTreatmentPlan}
                disabled={startingPlan}
                className="w-full h-11 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <BellRing className="w-4 h-4" />
                <span>{startingPlan ? 'Yoqilmoqda...' : 'Telegramda eslatma yoqish'}</span>
              </button>
            )}
          </div>

          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-[#3390EC]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Mutaxassis agronom bilan tekshirish
              </h3>
            </div>

            {existingConsult ? (
              <div className="rounded-xl bg-[#3390EC]/8 border border-[#3390EC]/20 p-3 text-[13px] text-[#0F172A] space-y-1">
                <p className="font-semibold text-[#3390EC]">
                  So'rov yuborildi · {existingConsult.agronomistName}
                </p>
                <p className="text-[#334155] text-[12px]">
                  Izoh: {existingConsult.note} · Javob Telegram botingizga keladi.
                </p>
              </div>
            ) : consultOpen ? (
              <form onSubmit={handleSendConsultation} className="space-y-2.5">
                <textarea
                  rows={2}
                  value={consultNote}
                  onChange={(e) => setConsultNote(e.target.value)}
                  placeholder="Masalan: Issiqxonada namlik baland, kecha sug'organdim..."
                  className="w-full p-3 rounded-xl bg-[#F4F4F5] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                />
                {consultError && <p className="text-[12px] text-red-600">{consultError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultOpen(false)}
                    className="h-10 rounded-xl bg-[#F4F4F5] text-[#334155] font-medium text-[13px]"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={sendingConsult}
                    className="h-10 rounded-xl bg-[#3390EC] text-white font-semibold text-[13px] disabled:opacity-60"
                  >
                    {sendingConsult ? 'Yuborilmoqda...' : 'Agronomga yuborish'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className="w-full h-11 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7]/70 text-[#0F172A] font-medium text-[14px] flex items-center justify-center gap-2 transition-colors"
              >
                <Stethoscope className="w-4 h-4 text-[#3390EC]" />
                <span>Agronomga ikkinchi fikr uchun yuborish</span>
              </button>
            )}
          </div>
        </section>
      )}

      {result.preventionTips.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3390EC]" />
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              Oldini olish va parvarish
            </h3>
          </div>
          <ul className="space-y-1.5 text-[14px] text-[#334155] list-disc pl-5">
            {result.preventionTips.map((tip, i) => (
              <li key={i} className="leading-snug">{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <section
        className={`rounded-2xl p-4 flex items-start gap-3 border ${
          result.healthStatus === 'healthy'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-[#3390EC]/8 border-[#3390EC]/20 text-[#0F172A]'
        }`}
      >
        <HeartHandshake
          className={`w-5 h-5 shrink-0 mt-0.5 ${
            result.healthStatus === 'healthy' ? 'text-emerald-600' : 'text-[#3390EC]'
          }`}
        />
        <div className="space-y-0.5">
          <p className="text-[13px] font-semibold">
            {result.healthStatus === 'healthy' ? 'Ajoyib natija!' : 'Dalda va maslahat'}
          </p>
          <p className="text-[14px] leading-relaxed">{result.motivationMessage}</p>
        </div>
      </section>

      {user && (
        <DiagnosisChatSection
          diagnosis={result}
          token={token}
          user={user}
          onUserUpdated={onUserUpdated}
          onDiagnosisUpdated={onDiagnosisUpdated}
          onOpenProUpgrade={onOpenProUpgrade}
        />
      )}

      {activePrep && dosage && user && onUserUpdated && (
        <OrderSheetModal
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          itemType="preparation"
          itemName={activePrep.name}
          defaultQuantity={`${dosage.formattedDose} (${dosage.formattedWater} uchun)`}
          userPhone={user.phone}
          token={token}
          onOrderCreated={onUserUpdated}
        />
      )}
    </div>
  );
}

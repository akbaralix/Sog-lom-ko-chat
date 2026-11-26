import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  Camera,
  ChevronRight,
  Crown,
  LogOut,
  PackageCheck,
  Phone,
  Stethoscope,
  User as UserIcon,
} from 'lucide-react';
import { formatUzbekPhoneDisplay } from '../lib/validation';
import { formatUzs } from '../lib/paymentCatalog';
import type { DiagnosisRecord, UserProfile } from '../types';
import { AnnotatedDiagnosisImage } from './AnnotatedDiagnosisImage';
import { DiagnosisResultView } from './DiagnosisResultView';
import { PWAInstallCard } from './PWAInstallCard';
import { ProCheckoutModal } from './ProCheckoutModal';

interface ProfileScreenProps {
  token?: string | null;
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  proModalOpen: boolean;
  onSetProModalOpen: (open: boolean) => void;
  onStartFollowUp?: (diagnosis: DiagnosisRecord) => void;
}

function formatUzbekDate(iso: string): string {
  const monthsUz = [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}-${monthsUz[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProfileScreen({
  token,
  user,
  onUserUpdated,
  onLogout,
  proModalOpen,
  onSetProModalOpen,
  onStartFollowUp,
}: ProfileScreenProps) {
  const [selectedHistory, setSelectedHistory] = useState<DiagnosisRecord | null>(null);

  const remaining = Math.max(0, user.scanLimit - user.scansUsed);
  const progressPct = Math.min(100, Math.round((remaining / user.scanLimit) * 100));
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const treatmentPlans = user.treatmentPlans ?? [];
  const consultations = user.consultations ?? [];
  const orders = user.orders ?? [];
  const paidPayments = (user.payments ?? []).filter((p) => p.status === 'paid');

  if (selectedHistory) {
    const formattedDate = formatUzbekDate(selectedHistory.createdAt);
    const parentDiagnosis = selectedHistory.parentDiagnosisId
      ? user.history.find((h) => h.id === selectedHistory.parentDiagnosisId) ?? null
      : null;

    return (
      <div className="flex-1 flex flex-col bg-[#F4F4F5] pb-28">
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E4E4E7] px-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedHistory(null)}
            aria-label="Orqaga qaytish"
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#3390EC] hover:bg-[#F4F4F5] active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-[#0F172A] truncate">
              {selectedHistory.productName}
            </h1>
            <p className="text-[12px] text-[#707579] truncate tabular-nums">{formattedDate}</p>
          </div>
        </header>

        <main className="p-4 space-y-3">
          {selectedHistory.imagePreview && (
            <AnnotatedDiagnosisImage
              imageUrl={selectedHistory.imagePreview}
              alt={selectedHistory.productName}
              spots={selectedHistory.affectedSpots}
            />
          )}

          <DiagnosisResultView
            result={selectedHistory}
            previousDiagnosis={parentDiagnosis}
            token={token}
            user={user}
            onUserUpdated={onUserUpdated}
            onDiagnosisUpdated={setSelectedHistory}
            onOpenProUpgrade={() => {
              setSelectedHistory(null);
              onSetProModalOpen(true);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F4F4F5] pb-28">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E4E4E7] px-4 flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-[#0F172A]">Profil</h1>
        {user.plan === 'pro' && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3390EC]">
            <Crown className="w-3.5 h-3.5" />
            <span>PRO</span>
          </span>
        )}
      </header>

      <main className="p-4 space-y-3.5">
        <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-5 flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover bg-[#E8ECEF] shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#3390EC] text-white flex items-center justify-center text-xl font-bold shrink-0">
              {initials || <UserIcon className="w-7 h-7" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-[#0F172A] truncate">
              {user.name}
            </h2>
            {user.username && (
              <p className="text-[13px] text-[#3390EC] truncate">@{user.username}</p>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#707579] tabular-nums">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>{formatUzbekPhoneDisplay(user.phone)}</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#0F172A]">
              Rasm tahlil limiti
            </span>
            <span className="text-[14px] font-semibold text-[#3390EC] tabular-nums">
              {remaining} / {user.scanLimit} ta qoldi
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#F4F4F5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3390EC] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[12px] text-[#707579] tabular-nums">
            Ishlatilgan: {user.scansUsed} ta · Tarif: {user.plan === 'pro' ? `Pro (${user.scanLimit} ta)` : `Bepul (${user.scanLimit} ta)`}
          </p>
        </section>

        {user.plan !== 'pro' ? (
          <section className="bg-[#3390EC] text-white rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4" />
                  <h3 className="text-[15px] font-semibold">Pro paketlarga o'tish</h3>
                </div>
                <p className="text-[13px] text-white/90 leading-snug">
                  50 yoki 100 ta rasm tahlili + cheksiz AI agronom suhbatini Click yoki Payme orqali oling.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSetProModalOpen(true)}
              className="w-full h-11 rounded-xl bg-white text-[#3390EC] font-semibold text-[14px] hover:bg-white/95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Tarifni tanlash (Click / Payme)</span>
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#3390EC]/10 text-[#3390EC] flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Pro versiya faol</p>
                <p className="text-[12px] text-[#707579] tabular-nums truncate">
                  Jami {user.scanLimit} ta tahlil · Cheksiz AI suhbat
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSetProModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-[#3390EC]/10 text-[#3390EC] text-[12px] font-semibold shrink-0 whitespace-nowrap"
            >
              Paket qo'shish
            </button>
          </section>
        )}

        <PWAInstallCard variant="card" />

        {treatmentPlans.length > 0 && (
          <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#3390EC]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Davolash nazorati
              </h3>
            </div>
            {treatmentPlans.slice(0, 5).map((plan) => {
              const sourceDiag = user.history.find((h) => h.id === plan.diagnosisId);
              return (
                <div key={plan.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#0F172A] truncate">
                      {plan.productName}
                    </p>
                    <p className="text-[12px] text-[#707579] tabular-nums">
                      {plan.status === 'completed'
                        ? "Tuzalish tasdiqlandi"
                        : `Qayta: ${formatUzbekDate(plan.nextCheckAt)}`}
                    </p>
                  </div>
                  {plan.status === 'active' && sourceDiag && onStartFollowUp ? (
                    <button
                      type="button"
                      onClick={() => onStartFollowUp(sourceDiag)}
                      className="h-9 px-3 rounded-xl bg-[#3390EC]/10 text-[#3390EC] text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Qayta tekshirish</span>
                    </button>
                  ) : (
                    <span className="text-[12px] font-semibold text-emerald-600 shrink-0">
                      Yakunlandi
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {user.history.length > 0 && (
          <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70 overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                So'nggi tekshiruvlar
              </h3>
            </div>
            {user.history.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedHistory(item)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F4F4F5]/70 active:bg-[#F4F4F5] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.imagePreview && (
                    <img
                      src={item.imagePreview}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover bg-[#E8ECEF] shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#0F172A] truncate">
                      {item.productName}
                    </p>
                    <p className="text-[12px] text-[#707579] truncate">
                      {item.diseaseName || "Kasallik aniqlanmadi"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[12px] font-medium ${
                      item.healthStatus === 'healthy'
                        ? 'text-emerald-600'
                        : item.healthStatus === 'attention'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {item.healthStatus === 'healthy'
                      ? "Sog'lom"
                      : item.healthStatus === 'attention'
                        ? "E'tibor"
                        : 'Kasallik'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </button>
            ))}
          </section>
        )}

        {(consultations.length > 0 || orders.length > 0) && (
          <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70 overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Agronom va buyurtmalar
              </h3>
            </div>
            {consultations.slice(0, 5).map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#3390EC]/10 text-[#3390EC] flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                    {c.productName}
                  </p>
                  <p className="text-[12px] text-[#3390EC] truncate">
                    {c.agronomistName}
                  </p>
                  <p className="text-[12px] text-[#707579] line-clamp-2 mt-0.5">
                    {c.note} · Javob Telegramga yuboriladi
                  </p>
                </div>
              </div>
            ))}
            {orders.slice(0, 5).map((o) => (
              <div key={o.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                    {o.itemName} ({o.quantityLabel})
                  </p>
                  <p className="text-[12px] text-[#707579] truncate">
                    {o.region} · {formatUzbekPhoneDisplay(o.phone)}
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}

        {paidPayments.length > 0 && (
          <section className="bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70 overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                To'lovlar tarixi
              </h3>
            </div>
            {paidPayments.slice(0, 5).map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[#0F172A] truncate">
                    {p.packageName} (+{p.scansAdded} ta)
                  </p>
                  <p className="text-[12px] text-[#707579] truncate tabular-nums">
                    {p.provider === 'click' ? 'Click' : 'Payme'} · {formatUzbekDate(p.paidAt || p.createdAt)}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-emerald-600 tabular-nums shrink-0">
                  {formatUzs(p.amountUzs)}
                </span>
              </div>
            ))}
          </section>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="w-full h-12 rounded-2xl bg-white border border-[#E4E4E7]/80 text-red-600 font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Hisobdan chiqish</span>
        </button>
      </main>

      <ProCheckoutModal
        open={proModalOpen}
        onClose={() => onSetProModalOpen(false)}
        token={token}
        onUserUpdated={onUserUpdated}
      />
    </div>
  );
}

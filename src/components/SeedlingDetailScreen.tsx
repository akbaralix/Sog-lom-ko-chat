import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Droplets,
  ShieldAlert,
  ShoppingBag,
  Sun,
  Thermometer,
} from 'lucide-react';
import type { SeedlingItem, UserProfile } from '../types';
import { OrderSheetModal } from './OrderSheetModal';

interface SeedlingDetailScreenProps {
  seedling: SeedlingItem;
  onBack: () => void;
  token?: string | null;
  user?: UserProfile;
  onUserUpdated?: (user: UserProfile) => void;
}

export function SeedlingDetailScreen({
  seedling,
  onBack,
  token,
  user,
  onUserUpdated,
}: SeedlingDetailScreenProps) {
  const [orderOpen, setOrderOpen] = useState(false);

  const careRows = [
    { icon: Calendar, label: 'Ekish mavsumi', value: seedling.season },
    { icon: Thermometer, label: 'Harorat', value: seedling.temperature },
    { icon: Sun, label: 'Yorug‘lik', value: seedling.sunlight },
    { icon: Droplets, label: 'Sug‘orish', value: seedling.watering },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F4F4F5] pb-24">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E4E4E7] px-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Orqaga qaytish"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#3390EC] hover:bg-[#F4F4F5] active:scale-95 transition-all shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold text-[#0F172A] truncate">
            {seedling.name}
          </h1>
          <p className="text-[12px] text-[#707579] truncate">{seedling.category}</p>
        </div>
      </header>

      <main className="space-y-3 pb-6">
        <div className="w-full aspect-[4/3] bg-[#E8ECEF] overflow-hidden relative flex items-center justify-center">
          <img
            src={seedling.image}
            alt={seedling.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <section className="mx-3.5 bg-white rounded-2xl p-4 border border-[#E4E4E7]/80 space-y-2">
          <h2 className="text-[15px] font-semibold text-[#0F172A]">
            Parvarish va ekish qoidalari
          </h2>
          <p className="text-[14px] leading-relaxed text-[#334155]">
            {seedling.overview}
          </p>
        </section>

        <section className="mx-3.5 bg-white rounded-2xl border border-[#E4E4E7]/80 divide-y divide-[#E4E4E7]/70">
          {careRows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#3390EC]/10 text-[#3390EC] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[#707579]">{row.label}</p>
                  <p className="text-[14px] text-[#0F172A] leading-snug mt-0.5">{row.value}</p>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <span className="text-[#707579] shrink-0">Tuproq</span>
              <span className="text-[#0F172A] text-right">{seedling.soil}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#707579] shrink-0">O‘g‘itlash</span>
              <span className="text-[#0F172A] text-right">{seedling.fertilizer}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#707579] shrink-0">Oraliq masofa</span>
              <span className="text-[#0F172A] text-right">{seedling.spacing}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#707579] shrink-0">Hosil muddati</span>
              <span className="text-[#0F172A] text-right">{seedling.harvest}</span>
            </div>
          </div>
        </section>

        <section className="mx-3.5 bg-white rounded-2xl p-4 border border-[#E4E4E7]/80 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#3390EC]" />
            <h2 className="text-[15px] font-semibold text-[#0F172A]">
              Kasalliklarni oldini olish
            </h2>
          </div>

          <ul className="space-y-2">
            {seedling.preventionSummary.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-[14px] text-[#334155] leading-snug">
                <span className="w-5 h-5 rounded-full bg-[#3390EC]/10 text-[#3390EC] text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {idx + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 space-y-2.5">
            {seedling.diseases.map((disease) => (
              <div
                key={disease.name}
                className="rounded-xl bg-[#F4F4F5] p-3.5 space-y-1.5"
              >
                <h3 className="text-[14px] font-semibold text-[#0F172A]">{disease.name}</h3>
                <p className="text-[13px] text-[#334155] leading-snug">
                  <span className="font-medium text-[#0F172A]">Belgilari:</span> {disease.symptoms}
                </p>
                <p className="text-[13px] text-[#334155] leading-snug">
                  <span className="font-medium text-[#0F172A]">Oldini olish:</span> {disease.prevention}
                </p>
              </div>
            ))}
          </div>
        </section>

        {user && onUserUpdated && (
          <div className="mx-3.5">
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.99] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Sog'lom ko'chat buyurtma qilish</span>
            </button>
          </div>
        )}
      </main>

      {user && onUserUpdated && (
        <OrderSheetModal
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          itemType="seedling"
          itemName={seedling.name}
          defaultQuantity="50 dona ko'chat"
          userPhone={user.phone}
          token={token}
          onOrderCreated={onUserUpdated}
        />
      )}
    </div>
  );
}

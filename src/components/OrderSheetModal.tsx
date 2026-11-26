import { useState } from 'react';
import { CheckCircle2, MapPin, PackageCheck, Phone, X } from 'lucide-react';
import { UZ_REGIONS } from '../lib/agroCatalog';
import { authFetch } from '../lib/clientSession';
import type { UserProfile } from '../types';

interface OrderSheetModalProps {
  open: boolean;
  onClose: () => void;
  itemType: 'preparation' | 'seedling';
  itemName: string;
  defaultQuantity: string;
  userPhone?: string;
  token?: string | null;
  onOrderCreated: (user: UserProfile) => void;
}

export function OrderSheetModal({
  open,
  onClose,
  itemType,
  itemName,
  defaultQuantity,
  userPhone = '',
  token,
  onOrderCreated,
}: OrderSheetModalProps) {
  const [quantityLabel, setQuantityLabel] = useState(defaultQuantity);
  const [region, setRegion] = useState(UZ_REGIONS[0].name);
  const [phone, setPhone] = useState(userPhone);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await authFetch(
        '/api/orders',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemType,
            itemName,
            quantityLabel,
            region,
            phone,
          }),
        },
        token,
      );
      const data = (await res.json()) as { user?: UserProfile; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || "Buyurtmani yuborishda xatolik yuz berdi.");
        return;
      }
      onOrderCreated(data.user);
      setSubmitted(true);
    } catch {
      setError("Server bilan aloqa o'rnatilmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agro-order-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
    >
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-5 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#3390EC]" />
            <h3 id="agro-order-title" className="text-[17px] font-bold text-[#0F172A]">
              Hamkor do'kondan buyurtma
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#707579] hover:bg-[#F4F4F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-4 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-[15px] font-semibold text-[#0F172A]">
              Buyurtma qabul qilindi!
            </p>
            <p className="text-[13px] text-[#707579] leading-relaxed">
              Hamkor agro-do'kon operatorimiz yaqin vaqt ichida <span className="font-medium text-[#0F172A]">{phone}</span> raqamingizga bog'lanadi.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="w-full h-11 rounded-xl bg-[#3390EC] text-white font-semibold text-[14px]"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="rounded-xl bg-[#F4F4F5] p-3">
              <p className="text-[12px] text-[#707579]">Tanlangan mahsulot</p>
              <p className="text-[14px] font-semibold text-[#0F172A] mt-0.5">{itemName}</p>
            </div>

            <div>
              <label htmlFor="order-qty" className="block text-[12px] font-medium text-[#707579] mb-1">
                Miqdori
              </label>
              <input
                id="order-qty"
                type="text"
                required
                value={quantityLabel}
                onChange={(e) => setQuantityLabel(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F4F5] text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
              />
            </div>

            <div>
              <label htmlFor="order-region" className="block text-[12px] font-medium text-[#707579] mb-1">
                Viloyat / Hudud
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#707579] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  id="order-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#F4F4F5] text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                >
                  {UZ_REGIONS.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="order-phone" className="block text-[12px] font-medium text-[#707579] mb-1">
                Aloqa raqami
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#707579] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="order-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#F4F4F5] text-[14px] tabular-nums text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#3390EC]"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3.5 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[15px] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Yuborilmoqda...' : 'Buyurtmani tasdiqlash'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

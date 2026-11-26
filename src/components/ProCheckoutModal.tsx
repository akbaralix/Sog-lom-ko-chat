import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { authFetch } from '../lib/clientSession';
import { PRO_PACKAGES, formatUzs } from '../lib/paymentCatalog';
import type {
  PaymentOrder,
  PaymentProvider,
  ProPackageId,
  UserProfile,
} from '../types';

interface ProCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  token?: string | null;
  onUserUpdated: (user: UserProfile) => void;
}

const PRO_BANNER_SRC = '/src/assets/images/pro_plan_banner_1795698428766.jpg';
const CLICK_CARD_SRC = '/src/assets/images/click_payment_card_1795698427793.jpg';
const PAYME_CARD_SRC = '/src/assets/images/payme_payment_card_1795698427507.jpg';

export function ProCheckoutModal({
  open,
  onClose,
  token,
  onUserUpdated,
}: ProCheckoutModalProps) {
  const [selectedPkg, setSelectedPkg] = useState<ProPackageId>('pro_100');
  const [provider, setProvider] = useState<PaymentProvider>('click');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingOrder, setPendingOrder] = useState<PaymentOrder | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [liveConfigured, setLiveConfigured] = useState(false);
  const [paidOrder, setPaidOrder] = useState<PaymentOrder | null>(null);

  const [bannerImgOk, setBannerImgOk] = useState(true);
  const [clickImgOk, setClickImgOk] = useState(true);
  const [paymeImgOk, setPaymeImgOk] = useState(true);

  const activePackage = PRO_PACKAGES.find((p) => p.id === selectedPkg) ?? PRO_PACKAGES[1];

  useEffect(() => {
    if (!open || !pendingOrder || !liveConfigured || paidOrder) return;

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const res = await authFetch(
            `/api/payments/${encodeURIComponent(pendingOrder.id)}`,
            {},
            token,
          );
          if (!res.ok) return;
          const data = (await res.json()) as { order?: PaymentOrder; user?: UserProfile };
          if (data.order?.status === 'paid' && data.user) {
            onUserUpdated(data.user);
            setPaidOrder(data.order);
            setPendingOrder(null);
          }
        } catch {
          // Keep polling silently while user completes payment
        }
      })();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [open, pendingOrder, liveConfigured, paidOrder, token, onUserUpdated]);

  if (!open) return null;

  function resetStateAndClose() {
    setPendingOrder(null);
    setCheckoutUrl(null);
    setPaidOrder(null);
    setError(null);
    onClose();
  }

  async function handleCreatePayment() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(
        '/api/payments/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packageId: selectedPkg,
            provider,
          }),
        },
        token,
      );
      const data = (await res.json()) as {
        order?: PaymentOrder;
        checkoutUrl?: string | null;
        liveConfigured?: boolean;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setError(data.error || "To'lov buyurtmasini yaratib bo'lmadi.");
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setPendingOrder(data.order);
      setCheckoutUrl(data.checkoutUrl ?? null);
      setLiveConfigured(Boolean(data.liveConfigured));
    } catch {
      setError("Server bilan aloqa o'rnatilmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSandboxConfirm() {
    if (!pendingOrder) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await authFetch(
        '/api/payments/sandbox-confirm',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId: pendingOrder.id }),
        },
        token,
      );
      const data = (await res.json()) as {
        order?: PaymentOrder;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok || !data.order || !data.user) {
        setError(data.error || "To'lovni tasdiqlashda xatolik yuz berdi.");
        return;
      }
      onUserUpdated(data.user);
      setPaidOrder(data.order);
      setPendingOrder(null);
    } catch {
      setError("Server bilan aloqa xatoligi.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
    >
      <div className="w-full max-w-[430px] max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl p-4 pb-8 space-y-4">
        <div className="w-10 h-1 bg-[#E4E4E7] rounded-full mx-auto" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-5 h-5 text-[#3390EC] shrink-0" />
            <h3 id="pro-modal-title" className="text-[18px] font-bold text-[#0F172A] truncate">
              Sog'lom Ko'chat Pro
            </h3>
          </div>
          <button
            type="button"
            onClick={resetStateAndClose}
            aria-label="Yopish"
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#707579] hover:bg-[#F4F4F5] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paidOrder ? (
          <div className="py-4 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[18px] font-bold text-[#0F172A]">
                To'lov muvaffaqiyatli qabul qilindi
              </h4>
              <p className="text-[13.5px] text-[#334155]">
                {paidOrder.packageName} · +{paidOrder.scansAdded} ta rasm tahlili va cheksiz AI agronom suhbati faollashtirildi.
              </p>
            </div>
            <div className="rounded-2xl bg-[#F4F4F5] p-3.5 text-left text-[13px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#707579]">To'lov tizimi</span>
                <span className="font-semibold text-[#0F172A]">
                  {paidOrder.provider === 'click' ? 'Click' : 'Payme'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#707579]">Summa</span>
                <span className="font-semibold text-[#0F172A] tabular-nums">
                  {formatUzs(paidOrder.amountUzs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#707579]">Buyurtma ID</span>
                <span className="font-mono text-[12px] text-[#334155]">{paidOrder.id}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={resetStateAndClose}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[15px]"
            >
              Ishni davom ettirish
            </button>
          </div>
        ) : pendingOrder ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E4E4E7] overflow-hidden bg-[#F8FAFC]">
              <div className="aspect-[16/7] w-full bg-[#E8ECEF] relative overflow-hidden">
                {(pendingOrder.provider === 'click' ? clickImgOk : paymeImgOk) ? (
                  <img
                    src={pendingOrder.provider === 'click' ? CLICK_CARD_SRC : PAYME_CARD_SRC}
                    alt={pendingOrder.provider === 'click' ? 'Click karta' : 'Payme hamyon'}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      pendingOrder.provider === 'click'
                        ? setClickImgOk(false)
                        : setPaymeImgOk(false)
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#3390EC]/10 text-[#3390EC] font-bold text-lg">
                    {pendingOrder.provider === 'click' ? 'Click' : 'Payme'}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-3.5">
                  <div className="text-white">
                    <p className="text-[12px] text-white/85">
                      {pendingOrder.provider === 'click' ? 'Click orqali to‘lov' : 'Payme orqali to‘lov'}
                    </p>
                    <p className="text-[20px] font-bold tabular-nums">
                      {formatUzs(pendingOrder.amountUzs)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#707579]">Paket</span>
                  <span className="font-semibold text-[#0F172A]">
                    {pendingOrder.packageName} ({pendingOrder.scansAdded} ta rasm)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707579]">Buyurtma raqami</span>
                  <span className="font-mono text-[12px] text-[#334155]">{pendingOrder.id}</span>
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-red-700 bg-red-50 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            {liveConfigured && checkoutUrl ? (
              <div className="space-y-2.5">
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-colors"
                >
                  <span>
                    {pendingOrder.provider === 'click' ? 'Click sahifasida to‘lash' : 'Payme sahifasida to‘lash'}
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[12px] text-center text-[#707579] flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3390EC]" />
                  <span>To'lov tasdiqlanishi avtomatik tekshirilmoqda...</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl bg-[#3390EC]/8 border border-[#3390EC]/20 p-3 flex items-start gap-2.5 text-[12.5px] text-[#0F172A]">
                  <ShieldCheck className="w-4 h-4 text-[#3390EC] shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    Sinov rejimi faol. Jonli savdo kalitlari ulanganda foydalanuvchi bevosita{' '}
                    {pendingOrder.provider === 'click' ? 'my.click.uz' : 'checkout.paycom.uz'} sahifasiga o‘tadi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSandboxConfirm}
                  disabled={confirming}
                  className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Tasdiqlanmoqda...</span>
                    </>
                  ) : (
                    <span>
                      {formatUzs(pendingOrder.amountUzs)} to'lovni tasdiqlash
                    </span>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPendingOrder(null);
                setCheckoutUrl(null);
                setError(null);
              }}
              className="w-full h-11 rounded-xl bg-[#F4F4F5] text-[#334155] font-medium text-[14px]"
            >
              Orqaga qaytish
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden border border-[#E4E4E7]/80 bg-[#F8FAFC]">
              <div className="aspect-[16/8] w-full bg-[#E8ECEF] relative overflow-hidden">
                {bannerImgOk ? (
                  <img
                    src={PRO_BANNER_SRC}
                    alt="Issiqxona ko'chatlarini AI tahlil qilish"
                    referrerPolicy="no-referrer"
                    onError={() => setBannerImgOk(false)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#3390EC]/15 to-emerald-500/15 flex items-center justify-center">
                    <Crown className="w-10 h-10 text-[#3390EC]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end p-3.5">
                  <p className="text-[13.5px] font-medium text-white leading-snug">
                    Kasalliklarni erta aniqlang, cheksiz AI agronom suhbatidan foydalaning
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0F172A]">1. Tarif paketini tanlang</p>
              <div className="grid grid-cols-2 gap-2.5">
                {PRO_PACKAGES.map((pkg) => {
                  const active = selectedPkg === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPkg(pkg.id)}
                      className={`text-left rounded-2xl p-3 border transition-all flex flex-col justify-between gap-2 min-h-[112px] ${
                        active
                          ? 'border-[#3390EC] bg-[#3390EC]/6 ring-1 ring-[#3390EC]'
                          : 'border-[#E4E4E7] bg-white hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                          {pkg.name}
                        </span>
                        {pkg.recommended && (
                          <span className="text-[10.5px] font-semibold text-[#3390EC] whitespace-nowrap">
                            Foydali
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-[17px] font-bold text-[#0F172A] tabular-nums">
                          {formatUzs(pkg.priceUzs)}
                        </p>
                        <p className="text-[12px] text-[#0F172A] font-medium tabular-nums">
                          {pkg.scansAdded} ta rasm tahlili
                        </p>
                        <p className="text-[11.5px] text-[#707579] tabular-nums">
                          {pkg.perScanUzs} so'm / rasm
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 text-[13px] text-[#334155] px-0.5">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#3390EC] shrink-0" />
                <span>+{activePackage.scansAdded} ta AI ko'chat va barg tahlili</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#3390EC] shrink-0" />
                <span>Har bir tashxisda cheksiz AI Agronom bilan suhbat</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0F172A]">2. To'lov tizimini tanlang</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setProvider('click')}
                  aria-pressed={provider === 'click'}
                  className={`rounded-2xl overflow-hidden border text-left transition-all ${
                    provider === 'click'
                      ? 'border-[#0090FF] ring-1 ring-[#0090FF] bg-[#0090FF]/5'
                      : 'border-[#E4E4E7] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="aspect-[16/9] w-full bg-[#E8ECEF] overflow-hidden">
                    {clickImgOk ? (
                      <img
                        src={CLICK_CARD_SRC}
                        alt="Click orqali to'lash"
                        referrerPolicy="no-referrer"
                        onError={() => setClickImgOk(false)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0090FF]/15" />
                    )}
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold tracking-tight text-[#0077E6]">
                      Click
                    </span>
                    <span className="text-[11px] text-[#707579]">Uzcard / Humo</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('payme')}
                  aria-pressed={provider === 'payme'}
                  className={`rounded-2xl overflow-hidden border text-left transition-all ${
                    provider === 'payme'
                      ? 'border-[#00B5B8] ring-1 ring-[#00B5B8] bg-[#00CCCC]/8'
                      : 'border-[#E4E4E7] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="aspect-[16/9] w-full bg-[#E8ECEF] overflow-hidden">
                    {paymeImgOk ? (
                      <img
                        src={PAYME_CARD_SRC}
                        alt="Payme orqali to'lash"
                        referrerPolicy="no-referrer"
                        onError={() => setPaymeImgOk(false)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#00CCCC]/15" />
                    )}
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold tracking-tight text-[#00A8AA]">
                      Payme
                    </span>
                    <span className="text-[11px] text-[#707579]">Uzcard / Humo</span>
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-red-700 bg-red-50 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreatePayment}
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[15px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buyurtma tayyorlanmoqda...</span>
                </>
              ) : (
                <span className="tabular-nums">
                  {formatUzs(activePackage.priceUzs)} to'lash · {provider === 'click' ? 'Click' : 'Payme'}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

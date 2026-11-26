import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { getInstallInstructionsUz } from '../lib/pwaInstall';
import { AppLogo } from './AppLogo';

interface PWAInstallCardProps {
  variant?: 'compact' | 'card';
}

export function PWAInstallCard({ variant = 'card' }: PWAInstallCardProps) {
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled || platform === 'standalone') {
    return null;
  }

  async function handleInstallClick() {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  }

  const instructions = getInstallInstructionsUz(
    platform === 'ios_safari' ? 'ios_safari' : 'browser_manual',
  );

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          aria-label="Ilova sifatida o'rnatish"
          className="h-9 px-3 rounded-xl bg-[#3390EC]/10 hover:bg-[#3390EC]/15 text-[#3390EC] text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ilova</span>
        </button>
      ) : (
        <section
          aria-label="Telefon ilovasi sifatida o'rnatish"
          className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-4 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo size="md" />
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-[#0F172A] leading-snug">
                Ilovani o'rnatish
              </h3>
              <p className="text-[12px] text-[#707579] leading-snug">
                Android va iPhone ekraniga alohida ilova bo'lib tushadi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="h-10 px-3.5 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] active:scale-[0.98] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>O'rnatish</span>
          </button>
        </section>
      )}

      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[398px] bg-white rounded-2xl border border-[#E4E4E7] p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AppLogo size="md" />
                <div className="min-w-0">
                  <h2 id="pwa-guide-title" className="text-[16px] font-semibold text-[#0F172A]">
                    {instructions.title}
                  </h2>
                  <p className="text-[12px] text-[#707579]">Sog'lom Ko'chat · Mustaqil ilova</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Yopish"
                className="w-9 h-9 -mr-1 -mt-1 rounded-full flex items-center justify-center text-[#707579] hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#F4F4F5] p-3.5 space-y-2 text-[13px] text-[#334155] leading-relaxed">
              {instructions.steps.map((step) => (
                <p key={step}>{step}</p>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[12px] text-[#707579]">
              <Smartphone className="w-4 h-4 text-[#3390EC] shrink-0" />
              <span>O'rnatilgach, telefoningiz menyusida ochiladi.</span>
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="w-full h-11 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[14px]"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-[12px] font-medium text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
      <span>Oflayn rejim — saqlangan ma'lumotlar ko'rsatilmoqda</span>
    </div>
  );
}

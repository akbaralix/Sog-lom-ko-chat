import { Camera, Sprout, User } from 'lucide-react';
import type { AppTab } from '../types';

interface BottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white/95 backdrop-blur-md border-t border-[#E4E4E7] pb-safe"
    >
      <div className="grid grid-cols-3 items-center h-16 px-2">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'home' ? 'text-[#3390EC]' : 'text-[#707579] hover:text-[#0F172A]'
          }`}
        >
          <Sprout className="w-[22px] h-[22px]" strokeWidth={activeTab === 'home' ? 2.25 : 1.75} />
          <span className="text-[11px] font-medium mt-1 whitespace-nowrap">Ko'chatlar</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onSelectTab('camera')}
            aria-label="Kamerani ochish va rasmni tekshirish"
            aria-current={activeTab === 'camera' ? 'page' : undefined}
            className={`w-14 h-14 -mt-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ring-4 ring-white ${
              activeTab === 'camera'
                ? 'bg-[#227AD6] text-white shadow-[#3390EC]/40'
                : 'bg-[#3390EC] text-white shadow-[#3390EC]/30 hover:bg-[#2980D9]'
            }`}
          >
            <Camera className="w-7 h-7" strokeWidth={2} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'profile' ? 'text-[#3390EC]' : 'text-[#707579] hover:text-[#0F172A]'
          }`}
        >
          <User className="w-[22px] h-[22px]" strokeWidth={activeTab === 'profile' ? 2.25 : 1.75} />
          <span className="text-[11px] font-medium mt-1 whitespace-nowrap">Profil</span>
        </button>
      </div>
    </nav>
  );
}

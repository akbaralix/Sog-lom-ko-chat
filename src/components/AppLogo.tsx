import { useState } from 'react';
import { Sprout } from 'lucide-react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AppLogo({ size = 'sm', className = '' }: AppLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass =
    size === 'lg'
      ? 'w-20 h-20 rounded-[22px] shadow-lg shadow-emerald-600/25'
      : size === 'md'
        ? 'w-11 h-11 rounded-2xl shadow-sm'
        : 'w-8 h-8 rounded-[10px] shadow-xs';

  const iconSize = size === 'lg' ? 'w-10 h-10' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4';

  if (imgFailed) {
    return (
      <div
        role="img"
        aria-label="Sog'lom Ko'chat logotipi"
        className={`${sizeClass} bg-gradient-to-br from-[#059669] to-[#16A34A] text-white flex items-center justify-center shrink-0 select-none ${className}`.trim()}
      >
        <Sprout className={iconSize} />
      </div>
    );
  }

  return (
    <img
      src="/pwa-192x192.png"
      alt="Sog'lom Ko'chat logotipi"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${sizeClass} bg-[#0B8A57] object-cover shrink-0 select-none ${className}`.trim()}
    />
  );
}

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AppLogo({ size = 'sm', className = '' }: AppLogoProps) {
  const sizeClass =
    size === 'lg'
      ? 'w-20 h-20 rounded-[22px] shadow-lg shadow-[#3390EC]/25'
      : size === 'md'
        ? 'w-11 h-11 rounded-2xl shadow-sm'
        : 'w-8 h-8 rounded-[10px] shadow-xs';

  return (
    <img
      src="/pwa-192x192.png"
      alt="Sog'lom Ko'chat logotipi"
      referrerPolicy="no-referrer"
      className={`${sizeClass} object-cover shrink-0 select-none ${className}`.trim()}
    />
  );
}

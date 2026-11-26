import { useEffect, useState } from 'react';
import { CloudRain, Droplets, MapPin, ShieldAlert, Sprout, Thermometer } from 'lucide-react';
import { SEEDLINGS } from '../data/seedlings';
import { UZ_REGIONS } from '../lib/agroCatalog';
import type { SeedlingItem, WeatherRiskReport } from '../types';
import { AppLogo } from './AppLogo';

interface HomeScreenProps {
  onSelectSeedling: (seedling: SeedlingItem) => void;
}

export function HomeScreen({ onSelectSeedling }: HomeScreenProps) {
  const [regionId, setRegionId] = useState<string>(UZ_REGIONS[0].id);
  const [risk, setRisk] = useState<WeatherRiskReport | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/weather/risk?region=${encodeURIComponent(regionId)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = (await res.json()) as WeatherRiskReport;
        if (!cancelled) setRisk(data);
      } catch {
        // Ignore transient weather fetch errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const riskBadgeStyle =
    risk?.riskLevel === 'high'
      ? 'bg-red-50 text-red-700'
      : risk?.riskLevel === 'medium'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700';

  const riskBadgeText =
    risk?.riskLevel === 'high'
      ? 'Yuqori xavf'
      : risk?.riskLevel === 'medium'
        ? "O'rta xavf"
        : 'Xavf past';

  return (
    <div className="flex-1 flex flex-col pb-28">
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E4E4E7] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo size="sm" />
          <h1 className="text-[17px] font-semibold text-[#0F172A] truncate">
            Sog'lom Ko'chat
          </h1>
        </div>

        <label className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3390EC]">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <select
            aria-label="Hududni tanlash"
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="bg-transparent text-[#3390EC] font-medium focus:outline-none cursor-pointer pr-1"
          >
            {UZ_REGIONS.map((r) => (
              <option key={r.id} value={r.id} className="text-[#0F172A]">
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="p-3.5 space-y-3">
        {risk && (
          <section
            aria-label="Hududiy agro-ob-havo radari"
            className="bg-white rounded-2xl border border-[#E4E4E7]/80 p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[12px] text-[#334155] tabular-nums">
                <span className="inline-flex items-center gap-1 font-medium text-[#0F172A]">
                  <Thermometer className="w-3.5 h-3.5 text-[#3390EC]" />
                  {risk.temperatureC}°C
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-[#3390EC]" />
                  {risk.humidityPct}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5 text-[#3390EC]" />
                  {risk.rainProbabilityPct}%
                </span>
              </div>

              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${riskBadgeStyle}`}>
                {riskBadgeText}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full text-left flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-[#3390EC] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#0F172A] leading-snug">
                  {risk.headline}
                </p>
                {expanded && (
                  <div className="mt-1.5 space-y-1 text-[12px] text-[#707579] leading-relaxed">
                    <p>{risk.tip}</p>
                    <p className="text-[#3390EC] font-medium tabular-nums">
                      So'nggi 7 kunda tizimda {risk.communityAlertsCount} ta kasallik holati qayd etildi
                    </p>
                  </div>
                )}
              </div>
            </button>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SEEDLINGS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSeedling(item)}
              className="group bg-white rounded-2xl overflow-hidden border border-[#E4E4E7]/80 text-left flex flex-col transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390EC]"
            >
              <div className="w-full aspect-[4/3] bg-[#E8ECEF] overflow-hidden relative flex items-center justify-center">
                <Sprout className="w-8 h-8 text-[#94A3B8]" aria-hidden="true" />
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h2 className="text-[14px] font-semibold text-[#0F172A] leading-snug truncate">
                  {item.name}
                </h2>
                <p className="mt-1 text-[12px] leading-[1.45] text-[#707579] line-clamp-2">
                  {item.shortDescription}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

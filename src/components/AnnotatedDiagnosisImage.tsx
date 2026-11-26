import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { computeArrowGeometry } from '../lib/agroCatalog';
import type { AffectedSpot } from '../types';

interface AnnotatedDiagnosisImageProps {
  imageUrl: string;
  alt: string;
  spots?: AffectedSpot[];
}

export function AnnotatedDiagnosisImage({
  imageUrl,
  alt,
  spots = [],
}: AnnotatedDiagnosisImageProps) {
  const [showMarkers, setShowMarkers] = useState(true);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(spots[0]?.id ?? null);

  const hasSpots = spots.length > 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E4E4E7]/80">
      <div className="w-full aspect-[4/3] bg-[#E8ECEF] relative overflow-hidden">
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
        />

        {hasSpots && showMarkers && (
          <svg
            viewBox="0 0 400 300"
            data-testid="disease-arrow-overlay"
            aria-label="Zararlangan joylar ko'rsatkichi"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <marker
                id="agro-arrow-high"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1" />
              </marker>
              <marker
                id="agro-arrow-medium"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1" />
              </marker>
            </defs>

            {spots.map((spot, idx) => {
              const geo = computeArrowGeometry(spot.xPercent, spot.yPercent);
              const tipX = geo.tipX * 4;
              const tipY = geo.tipY * 3;
              const tailX = geo.tailX * 4;
              const tailY = geo.tailY * 3;
              const dx = tipX - tailX;
              const dy = tipY - tailY;
              const dist = Math.hypot(dx, dy) || 1;
              const endX = tipX - (dx / dist) * 14;
              const endY = tipY - (dy / dist) * 14;

              const isSelected = activeSpotId === spot.id;
              const color = spot.severity === 'high' ? '#EF4444' : '#F59E0B';
              const markerId =
                spot.severity === 'high' ? 'url(#agro-arrow-high)' : 'url(#agro-arrow-medium)';

              return (
                <g key={spot.id} opacity={activeSpotId && !isSelected ? 0.72 : 1}>
                  {/* Highlight ring around detected spot */}
                  <circle
                    cx={tipX}
                    cy={tipY}
                    r={isSelected ? 15 : 12}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    opacity="0.85"
                  />
                  <circle
                    cx={tipX}
                    cy={tipY}
                    r={isSelected ? 15 : 12}
                    fill={color}
                    fillOpacity="0.16"
                    stroke={color}
                    strokeWidth="2.5"
                  />

                  {/* White outer outline + colored vector arrow */}
                  <line
                    x1={tailX}
                    y1={tailY}
                    x2={endX}
                    y2={endY}
                    stroke="#FFFFFF"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={tailX}
                    y1={tailY}
                    x2={endX}
                    y2={endY}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    markerEnd={markerId}
                  />

                  {/* Numbered tail marker */}
                  <circle cx={tailX} cy={tailY} r="11" fill={color} stroke="#FFFFFF" strokeWidth="2" />
                  <text
                    x={tailX}
                    y={tailY + 4}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {hasSpots && (
          <button
            type="button"
            onClick={() => setShowMarkers((prev) => !prev)}
            className="absolute top-2.5 right-2.5 h-8 px-2.5 rounded-full bg-[#0F172A]/75 hover:bg-[#0F172A]/90 backdrop-blur-xs text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          >
            {showMarkers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showMarkers ? 'Strelkani yashirish' : 'Strelkani ko‘rsatish'}</span>
          </button>
        )}
      </div>

      {hasSpots && (
        <div className="px-3.5 py-2.5 border-t border-[#E4E4E7]/70 bg-[#FAFAFA] space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#707579]">
            Rasmdagi aniqlangan joylar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {spots.map((spot, idx) => {
              const isSelected = activeSpotId === spot.id;
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => {
                    setShowMarkers(true);
                    setActiveSpotId(spot.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors ${
                    isSelected
                      ? 'bg-white border-[#3390EC] text-[#0F172A] shadow-xs'
                      : 'bg-white/70 border-[#E4E4E7] text-[#334155]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      spot.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>{spot.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

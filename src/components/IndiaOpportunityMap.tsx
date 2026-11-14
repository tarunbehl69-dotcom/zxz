import type { RegionScoredRecord } from '../types';

interface Props {
  regions: RegionScoredRecord[];
  selectedId: string | null;
  onSelect: (region: RegionScoredRecord) => void;
}

// Converts India lat/lng bounds (Lat 8..35, Lng 68..96) into SVG coordinates (0..420 x 0..460)
function projectPoint(latStr: string, lngStr: string) {
  const lat = Number(latStr);
  const lng = Number(lngStr);
  const x = ((lng - 67.5) / (96.5 - 67.5)) * 380 + 20;
  const y = ((35.5 - lat) / (35.5 - 7.5)) * 420 + 20;
  return { x: Math.max(24, Math.min(396, x)), y: Math.max(24, Math.min(436, y)) };
}

export function IndiaOpportunityMap({ regions, selectedId, onSelect }: Props) {
  return (
    <div className="relative bg-[#F8FAFC] border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center">
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">India Regional Opportunity Footprint</span>
        <span className="text-xs text-slate-500 tabular-nums">Marker size = Opportunity Score</span>
      </div>

      <svg
        viewBox="0 0 420 460"
        className="w-full max-w-[380px] h-auto"
        role="img"
        aria-label="India Regional Opportunity Visualization"
      >
        {/* Subtle graticule grid */}
        <g stroke="#E2E8F0" strokeWidth="0.75" strokeDasharray="3 3">
          <line x1="20" y1="115" x2="400" y2="115" />
          <line x1="20" y1="230" x2="400" y2="230" />
          <line x1="20" y1="345" x2="400" y2="345" />
          <line x1="120" y1="20" x2="120" y2="440" />
          <line x1="210" y1="20" x2="210" y2="440" />
          <line x1="300" y1="20" x2="300" y2="440" />
        </g>

        {/* Simplified India geographic silhouette path */}
        <path
          d="M158,36 L186,34 L208,58 L206,86 L236,108 L280,126 L332,126 L362,118 L382,140 L356,166 L336,164 L322,188 L302,202 L292,230 L272,254 L250,286 L234,322 L214,358 L194,404 L178,434 L164,412 L152,374 L138,332 L126,292 L116,254 L106,220 L84,202 L72,180 L98,162 L92,134 L118,112 L134,82 L144,54 Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />

        {/* Zone Labels */}
        <text x="155" y="92" fontSize="9" fill="#94A3B8" fontWeight="600">NORTH</text>
        <text x="98" y="214" fontSize="9" fill="#94A3B8" fontWeight="600">WEST</text>
        <text x="182" y="218" fontSize="9" fill="#94A3B8" fontWeight="600">CENTRAL</text>
        <text x="292" y="182" fontSize="9" fill="#94A3B8" fontWeight="600">EAST</text>
        <text x="172" y="346" fontSize="9" fill="#94A3B8" fontWeight="600">SOUTH</text>

        {/* Plotted regional hubs */}
        {regions.map((region) => {
          const { x, y } = projectPoint(region.latitude, region.longitude);
          const isSelected = region.id === selectedId;
          const radius = Math.max(8, Math.min(18, (region.opportunityScore / 100) * 18));
          const fill =
            region.opportunityScore >= 80
              ? '#249B91'
              : region.opportunityScore >= 68
                ? '#4A89B8'
                : '#64748B';

          return (
            <g
              key={region.id}
              onClick={() => onSelect(region)}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={radius + 6}
                  fill="none"
                  stroke="#173650"
                  strokeWidth="2"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={fill}
                fillOpacity={0.85}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#FFFFFF"
                className="font-mono"
              >
                {Math.round(region.opportunityScore)}
              </text>
              <text
                x={x}
                y={y + radius + 12}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight={isSelected ? '700' : '500'}
                fill="#173650"
              >
                {region.stateName}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="w-full flex items-center justify-center gap-4 mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#249B91]" /> Score 80+ (High)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4A89B8]" /> Score 68-79
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#64748B]" /> Baseline
        </span>
      </div>
    </div>
  );
}

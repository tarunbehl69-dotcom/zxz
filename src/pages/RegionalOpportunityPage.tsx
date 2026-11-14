import { useEffect, useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { IndiaOpportunityMap } from '../components/IndiaOpportunityMap';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { RegionScoredRecord } from '../types';

interface Weights {
  demandPotential: number;
  salesGrowth: number;
  customerDensity: number;
  distributionGap: number;
  competitiveOpportunity: number;
}

export function RegionalOpportunityPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [regions, setRegions] = useState<RegionScoredRecord[]>([]);
  const [selected, setSelected] = useState<RegionScoredRecord | null>(null);
  const [weights, setWeights] = useState<Weights>({
    demandPotential: 30,
    salesGrowth: 20,
    customerDensity: 20,
    distributionGap: 15,
    competitiveOpportunity: 15,
  });
  const [showWeights, setShowWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);

  const loadData = async () => {
    try {
      const res = await apiRequest<{ weights: Weights; regions: RegionScoredRecord[] }>('/api/regional');
      setWeights(res.weights);
      setRegions(res.regions);
      if (res.regions.length > 0 && !selected) {
        setSelected(res.regions[0]);
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load regions', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalWeight =
    weights.demandPotential +
    weights.salesGrowth +
    weights.customerDensity +
    weights.distributionGap +
    weights.competitiveOpportunity;

  const saveWeights = async () => {
    if (Math.abs(totalWeight - 100) > 0.1) {
      addToast({ type: 'error', title: 'Invalid Weights', message: `Weights must sum to 100% (currently ${totalWeight}%).` });
      return;
    }
    setSavingWeights(true);
    try {
      await apiRequest('/api/regional/weights', { method: 'PUT', body: weights });
      await apiRequest('/api/regional/recalculate', { method: 'POST', body: {} });
      addToast({ type: 'success', title: 'Opportunity Weights Saved & Recalculated' });
      setShowWeights(false);
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setSavingWeights(false);
    }
  };

  const recalculate = async () => {
    try {
      await apiRequest('/api/regional/recalculate', { method: 'POST', body: {} });
      addToast({ type: 'success', title: 'Opportunities Recalculated from Live Metrics' });
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Recalculation Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">India Regional Opportunity Finder</h1>
          <p className="text-sm text-slate-600">
            Weighted state & hub scoring ({weights.demandPotential}% Demand + {weights.salesGrowth}% Growth + {weights.customerDensity}% Density + {weights.distributionGap}% Dist. Gap + {weights.competitiveOpportunity}% Competitive).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recalculate}
            className="px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate Scores</span>
          </button>
          {hasPermission('regional:configure') && (
            <button
              type="button"
              onClick={() => setShowWeights((v) => !v)}
              className="px-3.5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configure Weights</span>
            </button>
          )}
        </div>
      </div>

      {showWeights && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#173650]">Opportunity Scoring Formula Weights</h2>
            <span className={`text-xs font-mono font-semibold ${totalWeight === 100 ? 'text-[#249B91]' : 'text-red-600'}`}>
              Total: {totalWeight}% (Required: 100%)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ['demandPotential', 'Demand Potential %'],
              ['salesGrowth', 'Sales Growth %'],
              ['customerDensity', 'Customer Density %'],
              ['distributionGap', 'Distribution Gap %'],
              ['competitiveOpportunity', 'Competitive Opp %'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-slate-600 mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[key as keyof Weights]}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowWeights(false)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={savingWeights}
              onClick={saveWeights}
              className="px-4 py-1.5 text-xs font-medium bg-[#249B91] text-white rounded-md cursor-pointer"
            >
              {savingWeights ? 'Saving...' : 'Save & Recalculate'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <IndiaOpportunityMap
            regions={regions}
            selectedId={selected?.id || null}
            onSelect={(r) => setSelected(r)}
          />
        </div>

        <div className="lg:col-span-7 space-y-6">
          {selected && (
            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-bold text-[#173650]">
                    {selected.stateName} — {selected.cityName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selected.zone} Zone · {selected.dealerCount} Dealers · {selected.feedbackCount} Feedback Records
                    {selected.isSimulated ? ' · Simulated Baseline' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Opportunity Score</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-[#249B91]">
                    {selected.opportunityScore} / 100
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 border-y border-slate-100 text-xs">
                <div>
                  <div className="text-slate-500">Demand</div>
                  <div className="font-mono font-semibold text-[#173650]">{selected.demandScore}</div>
                </div>
                <div>
                  <div className="text-slate-500">Sales Growth</div>
                  <div className="font-mono font-semibold text-[#173650]">{selected.growthScore}</div>
                </div>
                <div>
                  <div className="text-slate-500">Cust. Density</div>
                  <div className="font-mono font-semibold text-[#173650]">{selected.densityScore}</div>
                </div>
                <div>
                  <div className="text-slate-500">Dist. Gap</div>
                  <div className="font-mono font-semibold text-[#173650]">{selected.distributionGapScore}</div>
                </div>
                <div>
                  <div className="text-slate-500">Sales Vol (MT)</div>
                  <div className="font-mono font-semibold text-[#173650]">{selected.totalVolumeMt}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-xs">
                <div>
                  <h3 className="font-semibold text-[#173650] mb-1">Reasons for Ranking</h3>
                  <ul className="space-y-1 text-slate-700">
                    {selected.rankingReasons.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-[#249B91] mb-1">Recommended Next Steps</h3>
                  <ul className="space-y-1 text-slate-700">
                    {selected.recommendedNextSteps.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Ranking Table */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
            <h2 className="text-base font-semibold text-[#173650] mb-3">State & City Opportunity Ranking</h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Rank</th>
                  <th className="py-2 pr-3 font-medium">State / Hub</th>
                  <th className="py-2 pr-3 font-medium text-right">Dealers</th>
                  <th className="py-2 pr-3 font-medium text-right">Volume (MT)</th>
                  <th className="py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regions.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`cursor-pointer hover:bg-slate-50 ${selected?.id === r.id ? 'bg-[#249B91]/5' : ''}`}
                  >
                    <td className="py-2.5 pr-3 font-mono text-slate-500">#{idx + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-[#173650]">{r.stateName}</div>
                      <div className="text-[11px] text-slate-500">{r.cityName} · {r.zone}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{r.dealerCount}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{r.totalVolumeMt}</td>
                    <td className="py-2.5 text-right font-mono font-bold tabular-nums text-[#249B91]">
                      {r.opportunityScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

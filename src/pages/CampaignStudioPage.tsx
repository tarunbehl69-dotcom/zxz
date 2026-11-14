import React, { useEffect, useState } from 'react';
import { CheckCircle2, Megaphone, Save, Send } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { CampaignRecord } from '../types';

export function CampaignStudioPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [selected, setSelected] = useState<CampaignRecord | null>(null);
  const [generating, setGenerating] = useState(false);

  // Generator inputs
  const [campaignType, setCampaignType] = useState('Sustainable packaging awareness');
  const [productName, setProductName] = useState('AquaShield Barrier Cupstock');
  const [targetAudience, setTargetAudience] = useState('QSR Procurement & Cup Converters');
  const [industry, setIndustry] = useState('Food & Beverage');
  const [region, setRegion] = useState('Maharashtra & Karnataka');
  const [objective, setObjective] = useState('Convert 15 regional beverage cup manufacturers from PE-coated board to PFAS-free barrier board.');
  const [budgetInr, setBudgetInr] = useState(1200000);
  const [durationWeeks, setDurationWeeks] = useState(10);

  // Editable draft fields
  const [editName, setEditName] = useState('');
  const [editKeyMessage, setEditKeyMessage] = useState('');
  const [editValueProp, setEditValueProp] = useState('');
  const [editObjective, setEditObjective] = useState('');

  const loadCampaigns = async (selectId?: string) => {
    try {
      const res = await apiRequest<{ campaigns: CampaignRecord[] }>('/api/campaigns');
      setCampaigns(res.campaigns);
      const target =
        (selectId ? res.campaigns.find((c) => c.id === selectId) : null) ||
        res.campaigns[0] ||
        null;
      if (target) syncEditor(target);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load campaigns', message: err instanceof Error ? err.message : '' });
    }
  };

  const syncEditor = (c: CampaignRecord) => {
    setSelected(c);
    setEditName(c.name);
    setEditKeyMessage(c.keyMessage);
    setEditValueProp(c.valueProposition);
    setEditObjective(c.objective);
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await apiRequest<{ campaign: CampaignRecord }>('/api/campaigns/generate', {
        method: 'POST',
        body: {
          campaignType,
          productName,
          targetAudience,
          industry,
          region,
          objective,
          budgetInr,
          durationWeeks,
        },
      });
      addToast({ type: 'success', title: 'Campaign Draft Created', message: 'Saved as draft for review and approval.' });
      await loadCampaigns(res.campaign.id);
    } catch (err) {
      addToast({ type: 'error', title: 'Generation Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setGenerating(false);
    }
  };

  const updateCampaign = async (nextStatus?: string) => {
    if (!selected) return;
    try {
      const res = await apiRequest<{ campaign: CampaignRecord }>(`/api/campaigns/${selected.id}`, {
        method: 'PATCH',
        body: {
          name: editName,
          keyMessage: editKeyMessage,
          valueProposition: editValueProp,
          objective: editObjective,
          status: nextStatus,
        },
      });
      addToast({
        type: 'success',
        title: nextStatus ? `Campaign Status: ${nextStatus}` : 'Draft Changes Saved',
      });
      await loadCampaigns(res.campaign.id);
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">AI Campaign Studio</h1>
        <p className="text-sm text-slate-600">
          Generate B2B campaign plans with explicit assumptions and budget proposals. Drafts always require human approval before activation.
        </p>
      </div>

      {/* Campaign Planner Form */}
      {hasPermission('campaign:write') && (
        <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Type</label>
              <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
                <option>Brand awareness</option>
                <option>Product launch</option>
                <option>B2B lead generation</option>
                <option>Dealer engagement</option>
                <option>Sustainable packaging awareness</option>
                <option>Customer retention</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Product / Grade</label>
              <select value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
                <option>ProPrint A4 Copier</option>
                <option>ValuePrint Copier 70</option>
                <option>ExecBright Laser 100</option>
                <option>UltraOpaque Maplitho</option>
                <option>HiWhite Offset 80</option>
                <option>StiffCore Virgin FBB</option>
                <option>UltraSmooth SBS Board</option>
                <option>AquaShield Barrier Cupstock</option>
                <option>GlossPro Coated Art</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Industry</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
                <option>Packaging</option>
                <option>FMCG</option>
                <option>Pharmaceuticals</option>
                <option>Food & Beverage</option>
                <option>Printing</option>
                <option>Publishing</option>
                <option>Education</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Region</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Proposed Budget (INR)</label>
              <input type="number" min={50000} step={50000} value={budgetInr} onChange={(e) => setBudgetInr(Number(e.target.value))} className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Duration (Weeks)</label>
              <input type="number" min={2} max={52} value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value))} className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Marketing objective..."
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              type="submit"
              disabled={generating}
              className="px-5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] disabled:opacity-60 text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{generating ? 'Generating Blueprint...' : 'Generate Campaign Draft'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Campaign List + Editable Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          <div className="p-4 font-semibold text-sm text-[#173650]">Saved Campaigns ({campaigns.length})</div>
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => syncEditor(c)}
              className={`w-full text-left p-4 hover:bg-slate-50 cursor-pointer ${
                selected?.id === c.id ? 'bg-[#249B91]/5' : ''
              }`}
            >
              <div className="text-xs font-semibold text-[#173650]">{c.name}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                {c.status.toUpperCase()} · ₹{Number(c.budgetInr).toLocaleString('en-IN')} · {c.durationWeeks}w
                {c.isSimulated ? ' · Simulated' : ''}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8">
          {selected ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">
                    {selected.campaignType} · {selected.productName} · {selected.region} · Status:{' '}
                    <span className="font-semibold text-[#173650]">{selected.status}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasPermission('campaign:write') && (
                    <button
                      type="button"
                      onClick={() => updateCampaign()}
                      className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft</span>
                    </button>
                  )}
                  {selected.status === 'draft' && hasPermission('campaign:write') && (
                    <button
                      type="button"
                      onClick={() => updateCampaign('pending_approval')}
                      className="px-3 py-1.5 rounded-md bg-[#4A89B8] text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit for Approval</span>
                    </button>
                  )}
                  {(selected.status === 'pending_approval' || selected.status === 'draft') &&
                    hasPermission('campaign:approve') && (
                      <button
                        type="button"
                        onClick={() => updateCampaign('approved')}
                        className="px-3 py-1.5 rounded-md bg-[#249B91] text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                  {selected.status === 'approved' && hasPermission('campaign:approve') && (
                    <button
                      type="button"
                      onClick={() => updateCampaign('active')}
                      className="px-3 py-1.5 rounded-md bg-[#173650] text-white text-xs font-medium cursor-pointer"
                    >
                      Activate Campaign
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Campaign Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Marketing Objective</label>
                  <textarea rows={2} value={editObjective} onChange={(e) => setEditObjective(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Value Proposition</label>
                    <textarea rows={3} value={editValueProp} onChange={(e) => setEditValueProp(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Key Marketing Message</label>
                    <textarea rows={3} value={editKeyMessage} onChange={(e) => setEditKeyMessage(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-[#173650] mb-1">Target Customer Persona</h3>
                <p className="text-xs text-slate-700">{selected.persona}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <h3 className="font-semibold text-[#173650] mb-2">Channel Recommendations</h3>
                  <div className="space-y-2">
                    {selected.channels.map((ch, i) => (
                      <div key={i} className="pb-1.5 border-b border-slate-100">
                        <div className="flex justify-between font-medium text-[#173650]">
                          <span>{ch.channel}</span>
                          <span className="font-mono">{ch.sharePercent}%</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{ch.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-[#173650] mb-2">Budget Allocation Proposal</h3>
                  <div className="space-y-2">
                    {selected.budgetAllocation.map((b, i) => (
                      <div key={i} className="flex justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-slate-700">{b.item}</span>
                        <span className="font-mono tabular-nums text-[#173650]">
                          ₹{Number(b.amountInr).toLocaleString('en-IN')} ({b.sharePercent}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <h3 className="font-semibold text-[#173650] mb-2">Campaign Calendar & KPIs</h3>
                  <div className="space-y-1.5 mb-3">
                    {selected.calendar.map((cal, i) => (
                      <div key={i} className="text-slate-700">
                        <span className="font-mono font-semibold text-[#173650]">{cal.week}:</span> {cal.milestone} — {cal.deliverable}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {selected.kpis.map((k, i) => (
                      <div key={i} className="flex justify-between text-slate-700">
                        <span>{k.metric}</span>
                        <span className="font-mono font-semibold text-[#249B91]">{k.target}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-[#173650] mb-2">Expected Outcomes & Explicit Assumptions</h3>
                  <ul className="space-y-1 text-slate-700 mb-3">
                    {selected.expectedOutcomes.map((o, i) => <li key={i}>• {o}</li>)}
                  </ul>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">Assumptions:</div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {selected.assumptions.map((a, i) => <li key={i}>• {a}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
              Select a campaign or generate a new draft above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

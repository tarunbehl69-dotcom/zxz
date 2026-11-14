import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSearch, GitCompare, Plus } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { CompetitorProductRecord, CompetitorRecord, DocumentRecord } from '../types';

export function CompetitorIntelligencePage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [compProducts, setCompProducts] = useState<CompetitorProductRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gapResult, setGapResult] = useState<{
    executiveComparison: string;
    competitiveGaps: string[];
    portfolioAdvantages: string[];
    recommendedCounterMoves: string[];
    dataLimitations: string[];
  } | null>(null);
  const [runningGap, setRunningGap] = useState(false);

  // Add competitor form
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [positioning, setPositioning] = useState('');
  const [sustainability, setSustainability] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceDate, setSourceDate] = useState(new Date().toISOString().slice(0, 10));
  const [verificationStatus, setVerificationStatus] = useState('Pending Review');

  // Document extraction
  const [extractDocId, setExtractDocId] = useState('');
  const [extracting, setExtracting] = useState(false);

  const loadData = async () => {
    try {
      const [compRes, docRes] = await Promise.all([
        apiRequest<{ competitors: CompetitorRecord[]; competitorProducts: CompetitorProductRecord[] }>('/api/competitors'),
        apiRequest<{ documents: DocumentRecord[] }>('/api/documents'),
      ]);
      setCompetitors(compRes.competitors);
      setCompProducts(compRes.competitorProducts);
      setDocuments(docRes.documents.filter((d) => d.status === 'indexed'));
      if (compRes.competitors.length >= 2 && selectedIds.length === 0) {
        setSelectedIds([compRes.competitors[0].id, compRes.competitors[1].id]);
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load competitors', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/competitors', {
        method: 'POST',
        body: {
          name,
          headquarters,
          marketPositioning: positioning,
          sustainabilityClaims: sustainability,
          sourceName,
          sourceDate,
          verificationStatus,
        },
      });
      addToast({ type: 'success', title: 'Competitor Profile Added' });
      setShowAddForm(false);
      setName('');
      setPositioning('');
      setSustainability('');
      setSourceName('');
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  const handleExtractFromDoc = async () => {
    if (!extractDocId) return;
    setExtracting(true);
    try {
      const res = await apiRequest<{
        extracted: {
          competitorName: string;
          headquarters: string;
          marketPositioning: string;
          sustainabilityClaims: string;
        };
        sourceName: string;
        sourceDate: string;
      }>('/api/competitors/extract-from-document', {
        method: 'POST',
        body: { documentId: extractDocId },
      });
      setShowAddForm(true);
      setName(res.extracted.competitorName || '');
      setHeadquarters(res.extracted.headquarters || 'India');
      setPositioning(res.extracted.marketPositioning || '');
      setSustainability(res.extracted.sustainabilityClaims || '');
      setSourceName(res.sourceName);
      setSourceDate(res.sourceDate);
      setVerificationStatus('Pending Review');
      addToast({ type: 'info', title: 'Extracted Draft Ready', message: 'Verify source-backed details before saving.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Extraction Error', message: err instanceof Error ? err.message : '' });
    } finally {
      setExtracting(false);
    }
  };

  const runGapAnalysis = async () => {
    setRunningGap(true);
    try {
      const res = await apiRequest<typeof gapResult>('/api/competitors/gap-analysis', {
        method: 'POST',
        body: { competitorIds: selectedIds },
      });
      setGapResult(res);
    } catch (err) {
      addToast({ type: 'error', title: 'Comparison Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setRunningGap(false);
    }
  };

  const priceChartData = compProducts
    .filter((p) => p.pricePerMtInr !== null && Number(p.pricePerMtInr) > 0)
    .map((p) => ({
      name: p.productName,
      priceInrMt: Number(p.pricePerMtInr),
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">Competitor Intelligence & Benchmarking</h1>
          <p className="text-sm text-slate-600">
            Source-verified competitor claims with explicit provenance, verification dates, and gap identification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runGapAnalysis}
            disabled={runningGap || selectedIds.length === 0}
            className="px-3.5 py-2 rounded-md bg-[#249B91] hover:bg-[#1E857C] disabled:opacity-60 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{runningGap ? 'Comparing...' : `Run Gap Analysis (${selectedIds.length})`}</span>
          </button>
          {hasPermission('competitor:write') && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3.5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Competitor</span>
            </button>
          )}
        </div>
      </div>

      {/* Extract from Knowledge Hub Document */}
      {hasPermission('competitor:write') && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
          <FileSearch className="w-4 h-4 text-[#173650] shrink-0" />
          <span className="text-xs font-medium text-[#173650]">Source-Backed Extraction:</span>
          <select
            value={extractDocId}
            onChange={(e) => setExtractDocId(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
          >
            <option value="">Select indexed Knowledge Hub report...</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.fileName})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!extractDocId || extracting}
            onClick={handleExtractFromDoc}
            className="px-3.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-[#173650] cursor-pointer whitespace-nowrap"
          >
            {extracting ? 'Extracting...' : 'Extract Claims'}
          </button>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreateCompetitor} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#173650]">Add Source-Verified Competitor Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Competitor Name" className="px-3 py-2 text-sm border border-slate-200 rounded-md" />
            <input value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} placeholder="Headquarters" className="px-3 py-2 text-sm border border-slate-200 rounded-md" />
            <input required value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Source Reference (Mandatory)" className="px-3 py-2 text-sm border border-slate-200 rounded-md" />
            <input required type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-md" />
            <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
              <option>Verified</option>
              <option>Pending Review</option>
              <option>Unverified</option>
            </select>
          </div>
          <textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} rows={2} placeholder="Market positioning (strictly source-backed)" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
          <textarea value={sustainability} onChange={(e) => setSustainability(e.target.value)} rows={2} placeholder="Sustainability claims" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md cursor-pointer">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-xs font-medium bg-[#173650] text-white rounded-md cursor-pointer">Save Profile</button>
          </div>
        </form>
      )}

      {/* AI Gap Analysis Output */}
      {gapResult && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#173650]">Competitive Gap Analysis</h2>
          <p className="text-sm text-[#1A2530]">{gapResult.executiveComparison}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div>
              <h3 className="font-semibold text-[#173650] mb-1.5">Competitive Gaps</h3>
              <ul className="space-y-1 text-slate-700">{gapResult.competitiveGaps.map((g, i) => <li key={i}>• {g}</li>)}</ul>
            </div>
            <div>
              <h3 className="font-semibold text-[#249B91] mb-1.5">Our Portfolio Advantages</h3>
              <ul className="space-y-1 text-slate-700">{gapResult.portfolioAdvantages.map((a, i) => <li key={i}>• {a}</li>)}</ul>
            </div>
            <div>
              <h3 className="font-semibold text-[#4A89B8] mb-1.5">Counter-Moves & Data Limits</h3>
              <ul className="space-y-1 text-slate-700">{gapResult.recommendedCounterMoves.map((m, i) => <li key={i}>• {m}</li>)}</ul>
            </div>
          </div>
        </section>
      )}

      {/* Competitor Profiles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {competitors.map((comp) => {
          const isSelected = selectedIds.includes(comp.id);
          return (
            <div
              key={comp.id}
              onClick={() => toggleSelect(comp.id)}
              className={`bg-white border rounded-lg p-5 cursor-pointer transition-colors ${
                isSelected ? 'border-[#249B91]' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-[#173650]">{comp.name}</h3>
                <input type="checkbox" checked={isSelected} readOnly className="mt-0.5 accent-[#249B91]" />
              </div>
              <div className="text-[11px] text-slate-500 mb-3">
                {comp.headquarters} · Status: <span className="font-medium text-[#173650]">{comp.verificationStatus}</span>
                {comp.isSimulated ? ' · Simulated Baseline' : ''}
              </div>
              <p className="text-xs text-slate-700 mb-3">{comp.marketPositioning}</p>
              <div className="text-xs text-slate-600 mb-3">
                <span className="font-semibold text-[#249B91]">Sustainability: </span>
                {comp.sustainabilityClaims}
              </div>
              <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                Source: {comp.sourceName} · {comp.sourceDate}
              </div>
            </div>
          );
        })}
      </div>

      {/* Product & Pricing Comparison Table + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 lg:col-span-2 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#173650] mb-3">Competitor Product & Pricing Comparison</h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">GSM / Brightness</th>
                <th className="py-2 pr-3 font-medium">Source · Date · Status</th>
                <th className="py-2 text-right font-medium">Price (INR/MT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compProducts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3 font-medium text-[#173650]">{p.productName}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{p.categoryName}</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-700">
                    {p.gsmRange} · {p.brightness}
                  </td>
                  <td className="py-2.5 pr-3 text-[11px] text-slate-500">
                    {p.sourceName} · {p.sourceDate} · {p.verificationStatus}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-[#173650]">
                    {p.pricePerMtInr ? `₹${Number(p.pricePerMtInr).toLocaleString('en-IN')}` : 'Unverified'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-[#173650] mb-3">Verified Price Benchmark (INR/MT)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="priceInrMt" name="INR / MT" fill="#4A89B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Search } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { NavModuleId } from '../types';

interface TaxonomyResponse {
  productCategories: Array<{ id: string; name: string; code: string; description: string }>;
  industries: string[];
  regions: Array<{ id: string; stateName: string; cityName: string }>;
}

interface MarketAnalysis {
  executiveOverview: string;
  sourcedFacts: Array<{ fact: string; citation: string }>;
  assumptions: string[];
  demandDrivers: Array<{ driver: string; impactLevel: string; explanation: string }>;
  opportunityAssessments: Array<{ segment: string; potential: string; rationale: string }>;
  strategicRecommendations: string[];
}

export function MarketIntelligencePage({ onNavigate }: { onNavigate: (id: NavModuleId) => void }) {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Packaging Boards');
  const [selectedIndustry, setSelectedIndustry] = useState('FMCG');
  const [selectedRegion, setSelectedRegion] = useState('All India');
  const [focusQuestion, setFocusQuestion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [chunksCount, setChunksCount] = useState(0);

  // Admin category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const loadTaxonomy = async () => {
    try {
      const res = await apiRequest<TaxonomyResponse>('/api/market/taxonomy');
      setTaxonomy(res);
      if (res.productCategories.length > 0) setSelectedCategory(res.productCategories[0].name);
      if (res.industries.length > 0) setSelectedIndustry(res.industries[0]);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load taxonomy', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    loadTaxonomy();
  }, []);

  const runAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const res = await apiRequest<{ analysis: MarketAnalysis; retrievedChunksCount: number }>('/api/market/analyze', {
        method: 'POST',
        body: {
          productCategory: selectedCategory,
          industry: selectedIndustry,
          region: selectedRegion,
          focusQuestion,
        },
      });
      setAnalysis(res.analysis);
      setChunksCount(res.retrievedChunksCount);
      addToast({ type: 'success', title: 'Market Analysis Complete', message: `Synthesized from ${res.retrievedChunksCount} Knowledge Hub excerpts.` });
    } catch (err) {
      addToast({ type: 'error', title: 'Analysis Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setAnalyzing(false);
    }
  };

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/market/categories', {
        method: 'POST',
        body: { name: catName, code: catCode, description: catDesc },
      });
      addToast({ type: 'success', title: 'Product Category Added', message: catName });
      setCatName('');
      setCatCode('');
      setCatDesc('');
      setShowNewCat(false);
      await loadTaxonomy();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to add category', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">Market Intelligence Workspace</h1>
          <p className="text-sm text-slate-600">
            Analyze demand drivers and growth opportunities grounded in Knowledge Hub reports, explicitly separating sourced facts from assumptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('knowledge')}
            className="px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Upload Market Report</span>
          </button>
          {hasPermission('settings:manage') && (
            <button
              type="button"
              onClick={() => setShowNewCat((v) => !v)}
              className="px-3.5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Category</span>
            </button>
          )}
        </div>
      </div>

      {showNewCat && (
        <form onSubmit={createCategory} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category Name</label>
            <input
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g., Thermal & Security Paper"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
            <input
              required
              value={catCode}
              onChange={(e) => setCatCode(e.target.value)}
              placeholder="e.g., TSP"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <input
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Applications and grade specs"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="px-4 py-2 rounded-md bg-[#249B91] text-white text-xs font-medium cursor-pointer">
              Save Category
            </button>
            <button type="button" onClick={() => setShowNewCat(false)} className="px-3 py-2 rounded-md border border-slate-200 text-xs text-slate-600 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Analysis Parameters Form */}
      <form onSubmit={runAnalysis} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {(taxonomy?.productCategories || []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Industry</label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {(taxonomy?.industries || []).map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Geographical Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option value="All India">All India</option>
              {(taxonomy?.regions || []).map((r) => (
                <option key={r.id} value={`${r.stateName} (${r.cityName})`}>
                  {r.stateName} — {r.cityName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={focusQuestion}
            onChange={(e) => setFocusQuestion(e.target.value)}
            placeholder="Optional focus prompt (e.g., Plastic-free barrier cupstock demand shift in QSR chains)"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <button
            type="submit"
            disabled={analyzing}
            className="px-5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] disabled:opacity-60 text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{analyzing ? 'Analyzing Market...' : 'Run Market Analysis'}</span>
          </button>
        </div>
      </form>

      {/* Structured Analysis Output */}
      {analysis ? (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs text-slate-500 mb-1">
              Executive Overview · Grounded in {chunksCount} Knowledge Hub excerpts
            </div>
            <p className="text-sm text-[#1A2530] leading-relaxed">{analysis.executiveOverview}</p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-[#173650] mb-3">Sourced Facts & Citations</h2>
              <div className="divide-y divide-slate-100">
                {analysis.sourcedFacts.map((item, idx) => (
                  <div key={idx} className="py-2.5">
                    <p className="text-sm text-[#1A2530]">{item.fact}</p>
                    <p className="text-xs text-[#249B91] mt-1 font-medium">Source: {item.citation}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-[#173650] mb-3">Explicit Analytical Assumptions</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {analysis.assumptions.map((a, idx) => (
                  <li key={idx} className="pb-2 border-b border-slate-100 last:border-0">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-[#173650] mb-3">Identified Demand Drivers</h2>
              <div className="divide-y divide-slate-100">
                {analysis.demandDrivers.map((d, idx) => (
                  <div key={idx} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#173650]">{d.driver}</span>
                      <span className="text-xs font-mono text-slate-500">Impact: {d.impactLevel}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{d.explanation}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-[#173650] mb-3">Opportunity Assessments & Strategic Recommendations</h2>
              <div className="divide-y divide-slate-100 mb-4">
                {analysis.opportunityAssessments.map((o, idx) => (
                  <div key={idx} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#173650]">{o.segment}</span>
                      <span className="text-xs font-mono text-[#249B91]">{o.potential}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{o.rationale}</p>
                  </div>
                ))}
              </div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">Recommended Actions</h3>
              <ul className="space-y-1.5 text-sm text-[#1A2530]">
                {analysis.strategicRecommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <h3 className="text-base font-semibold text-[#173650] mb-1">Select Segment & Run Analysis</h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Choose a product category, target customer industry, and region above. The platform will retrieve matching Knowledge Hub reports and synthesize sourced facts, assumptions, and recommendations.
          </p>
        </div>
      )}
    </div>
  );
}

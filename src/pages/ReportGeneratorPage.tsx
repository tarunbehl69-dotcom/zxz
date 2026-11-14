import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileBarChart2, FileSpreadsheet, Presentation } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { exportReportToExcel, exportReportToPdf, exportReportToPptx } from '../lib/export-reports';
import type { ReportRecord } from '../types';

const REPORT_CATEGORIES = [
  'Market research report',
  'Customer sentiment report',
  'Competitor benchmarking report',
  'Regional opportunity report',
  'Campaign performance report',
  'Executive marketing report',
];

export function ReportGeneratorPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [customScope, setCustomScope] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadReports = async (selectId?: string) => {
    try {
      const res = await apiRequest<{ reports: ReportRecord[] }>('/api/reports');
      setReports(res.reports);
      const target = (selectId ? res.reports.find((r) => r.id === selectId) : null) || res.reports[0] || null;
      setSelected(target);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load reports', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await apiRequest<{ report: ReportRecord }>('/api/reports/generate', {
        method: 'POST',
        body: { category, title, customScope },
      });
      addToast({ type: 'success', title: 'Report Generated', message: res.report.title });
      setTitle('');
      setCustomScope('');
      await loadReports(res.report.id);
    } catch (err) {
      addToast({ type: 'error', title: 'Generation Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">Marketing Report Generator</h1>
        <p className="text-sm text-slate-600">
          Generate structured management reports from live database records and Knowledge Hub citations, with PDF, Excel, and PowerPoint export.
        </p>
      </div>

      {hasPermission('report:write') && (
        <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Report Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
              {REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">Report Title (Optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Q4 Packaging Boards Expansion Brief" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Focus Scope</label>
            <input value={customScope} onChange={(e) => setCustomScope(e.target.value)} placeholder="Regions, products, or questions..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={generating}
              className="w-full px-4 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] disabled:opacity-60 text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileBarChart2 className="w-3.5 h-3.5" />
              <span>{generating ? 'Generating...' : 'Generate Report'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          <div className="p-4 text-sm font-semibold text-[#173650]">Generated Reports ({reports.length})</div>
          {reports.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">No reports generated yet. Use the form above to generate your first executive report.</div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left p-4 hover:bg-slate-50 cursor-pointer ${
                  selected?.id === r.id ? 'bg-[#249B91]/5' : ''
                }`}
              >
                <div className="text-xs font-semibold text-[#173650]">{r.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {r.category} · {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8">
          {selected ? (
            <article className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs text-[#249B91] font-medium">
                    {selected.category} · {new Date(selected.createdAt).toLocaleString()}
                  </div>
                  <h2 className="text-xl font-bold text-[#173650] mt-1">{selected.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportReportToPdf(selected)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReportToExcel(selected)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReportToPptx(selected)}
                    className="px-3 py-1.5 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span>PowerPoint</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-1">1. Executive Summary</h3>
                <p className="text-sm text-[#1A2530] leading-relaxed">{selected.executiveSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">2. Objective</h3>
                  <p className="text-xs text-slate-700">{selected.objective}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">3. Methodology</h3>
                  <p className="text-xs text-slate-700">{selected.methodology}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 mb-1">4. Data Sources</h3>
                <ul className="text-xs text-slate-700 space-y-1">
                  {selected.dataSources.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 mb-1">5. Analysis</h3>
                <p className="text-sm text-[#1A2530] leading-relaxed whitespace-pre-line">{selected.analysis}</p>
              </div>

              {selected.chartData && selected.chartData.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 mb-3">6. Quantitative Evidence Chart</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selected.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#249B91" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <h3 className="font-semibold text-[#173650] mb-1.5">7. Key Findings</h3>
                  <ul className="space-y-1 text-slate-700">{selected.keyFindings.map((f, i) => <li key={i}>• {f}</li>)}</ul>
                </div>
                <div>
                  <h3 className="font-semibold text-[#249B91] mb-1.5">8. Recommendations</h3>
                  <ul className="space-y-1 text-slate-700">{selected.recommendations.map((r, i) => <li key={i}>• {r}</li>)}</ul>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-600 mb-1.5">9. Assumptions</h3>
                  <ul className="space-y-1 text-slate-600">{selected.assumptions.map((a, i) => <li key={i}>• {a}</li>)}</ul>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-600 mb-1.5">10. Limitations</h3>
                  <ul className="space-y-1 text-slate-600">{selected.limitations.map((l, i) => <li key={i}>• {l}</li>)}</ul>
                </div>
              </div>
            </article>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
              Select a report from the list or generate a new one to preview and export.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

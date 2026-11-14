import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, Sparkles, Upload } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { CustomerFeedbackRecord } from '../types';

interface CustomerAnalytics {
  totalFeedback: number;
  avgRating: number;
  sentimentDistribution: Array<{ name: string; count: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  productPreferences: Array<{ product: string; mentions: number; avgRating: number }>;
  regionalBreakdown: Array<{ region: string; count: number; avgRating: number; positivePct: number }>;
  priceSensitivity: Array<{ level: string; count: number }>;
  topComplaints: Array<{ complaint: string; count: number }>;
  topRequestedFeatures: Array<{ feature: string; count: number }>;
}

export function CustomerIntelligencePage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [feedback, setFeedback] = useState<CustomerFeedbackRecord[]>([]);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual feedback form
  const [showManualForm, setShowManualForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [productName, setProductName] = useState('StiffCore Virgin FBB');
  const [regionName, setRegionName] = useState('Maharashtra');
  const [industry, setIndustry] = useState('Packaging');
  const [rating, setRating] = useState(4);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);

  // Recommendations
  const [aiRecs, setAiRecs] = useState<{
    summary: string;
    recommendations: Array<{ title: string; targetSegment: string; action: string; evidence: string }>;
  } | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        feedback: CustomerFeedbackRecord[];
        analytics: CustomerAnalytics;
      }>('/api/customers');
      setFeedback(res.feedback);
      setAnalytics(res.analytics);
    } catch (err) {
      addToast({ type: 'error', title: 'Load failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/api/customers/feedback', {
        method: 'POST',
        body: { customerName, productName, regionName, industry, rating, feedbackText, sourceType: 'Manual' },
      });
      addToast({ type: 'success', title: 'Feedback Saved & Classified' });
      setCustomerName('');
      setFeedbackText('');
      setShowManualForm(false);
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Submission Error', message: err instanceof Error ? err.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiRequest<{ message: string; importedCount: number }>('/api/customers/import', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      addToast({ type: 'success', title: 'Import Completed', message: res.message });
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Import Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const generateRecommendations = async () => {
    setGeneratingRecs(true);
    try {
      const res = await apiRequest<{
        summary: string;
        recommendations: Array<{ title: string; targetSegment: string; action: string; evidence: string }>;
      }>('/api/customers/recommendations', { method: 'POST' });
      setAiRecs(res);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to generate recommendations', message: err instanceof Error ? err.message : '' });
    } finally {
      setGeneratingRecs(false);
    }
  };

  const filteredFeedback = feedback.filter((f) => {
    if (sentimentFilter !== 'All' && f.sentiment !== sentimentFilter) return false;
    if (
      searchQuery.trim() &&
      !`${f.customerName} ${f.productName} ${f.regionName} ${f.feedbackText}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">Customer Intelligence Engine</h1>
          <p className="text-sm text-slate-600">
            Validated, deduplicated feedback analytics calculated directly from database records.
          </p>
        </div>

        {hasPermission('customer:write') && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>{importing ? 'Importing...' : 'Import CSV / Excel'}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                className="hidden"
                disabled={importing}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="px-3.5 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Feedback</span>
            </button>
          </div>
        )}
      </div>

      {showManualForm && (
        <form onSubmit={handleManualSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#173650]">Add Customer / Survey Feedback</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer / Account Name"
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
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
            <select
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option>Maharashtra</option>
              <option>Gujarat</option>
              <option>Delhi NCR</option>
              <option>Telangana</option>
              <option>Karnataka</option>
              <option>Tamil Nadu</option>
              <option>West Bengal</option>
            </select>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option>Packaging</option>
              <option>Pharmaceuticals</option>
              <option>FMCG</option>
              <option>Publishing</option>
              <option>Printing</option>
              <option>Education</option>
              <option>Food & Beverage</option>
            </select>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option value={5}>Rating: 5 / 5</option>
              <option value={4}>Rating: 4 / 5</option>
              <option value={3}>Rating: 3 / 5</option>
              <option value={2}>Rating: 2 / 5</option>
              <option value={1}>Rating: 1 / 5</option>
            </select>
          </div>
          <textarea
            required
            rows={2}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Enter customer comment, quality feedback, pricing objection, or feature request..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowManualForm(false)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-md cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-medium bg-[#249B91] text-white rounded-md cursor-pointer"
            >
              {submitting ? 'Analyzing & Saving...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}

      {/* Quantitative Summary Metrics */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Total Validated Records</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#173650] mt-1">
                {analytics.totalFeedback}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Average Satisfaction</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#249B91] mt-1">
                {analytics.avgRating} / 5.0
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Positive Sentiment Share</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#173650] mt-1">
                {analytics.totalFeedback > 0
                  ? Math.round(
                      ((analytics.sentimentDistribution.find((s) => s.name === 'Positive')?.count || 0) /
                        analytics.totalFeedback) *
                        100
                    )
                  : 0}
                %
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">High Price Sensitivity</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#4A89B8] mt-1">
                {analytics.priceSensitivity.find((p) => p.level === 'High')?.count || 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-[#173650] mb-4">Sentiment & Category Breakdown</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#334155' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Records" fill="#173650" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#173650] mb-2">Top Customer Complaints</h3>
                {analytics.topComplaints.length === 0 ? (
                  <p className="text-xs text-slate-500">No complaints logged.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {analytics.topComplaints.map((c) => (
                      <li key={c.complaint} className="flex justify-between gap-2 pb-1.5 border-b border-slate-100">
                        <span className="text-slate-700">{c.complaint}</span>
                        <span className="font-mono font-semibold text-red-700">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#173650] mb-2">Most Requested Features</h3>
                {analytics.topRequestedFeatures.length === 0 ? (
                  <p className="text-xs text-slate-500">No feature requests logged.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {analytics.topRequestedFeatures.map((f) => (
                      <li key={f.feature} className="flex justify-between gap-2 pb-1.5 border-b border-slate-100">
                        <span className="text-slate-700">{f.feature}</span>
                        <span className="font-mono font-semibold text-[#249B91]">{f.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {/* Actionable AI Recommendations */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#173650]">AI Actionable Marketing Recommendations</h2>
            <p className="text-xs text-slate-500">Synthesized strictly from live customer feedback records</p>
          </div>
          <button
            type="button"
            onClick={generateRecommendations}
            disabled={generatingRecs}
            className="px-3.5 py-2 rounded-md bg-[#249B91] hover:bg-[#1E857C] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{generatingRecs ? 'Generating...' : 'Generate Recommendations'}</span>
          </button>
        </div>

        {aiRecs && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-sm text-[#1A2530]">{aiRecs.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiRecs.recommendations.map((rec, i) => (
                <div key={i} className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-md">
                  <div className="text-xs font-semibold text-[#173650]">{rec.title}</div>
                  <div className="text-[11px] text-[#249B91] mt-0.5">Segment: {rec.targetSegment}</div>
                  <p className="text-xs text-slate-700 mt-1.5">{rec.action}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Evidence: {rec.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Feedback Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-[#173650]">Customer Feedback Records</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, product, text..."
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md"
            />
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {['All', 'Positive', 'Neutral', 'Negative'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSentimentFilter(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                    sentimentFilter === s ? 'bg-white text-[#173650] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse bg-slate-50 rounded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Customer</th>
                  <th className="py-2.5 pr-3 font-medium">Product · Region</th>
                  <th className="py-2.5 pr-3 font-medium">Feedback</th>
                  <th className="py-2.5 pr-3 font-medium">Sentiment</th>
                  <th className="py-2.5 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFeedback.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 align-top">
                      <div className="font-medium text-[#173650]">{item.customerName}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.industry} · {item.sourceType}
                        {item.isSimulated ? ' · Simulated' : ''}
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-700 whitespace-nowrap">
                      <div>{item.productName}</div>
                      <div className="text-[11px] text-slate-500">{item.regionName}</div>
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-700 max-w-md">{item.feedbackText}</td>
                    <td className="py-3 pr-3 align-top whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          item.sentiment === 'Positive'
                            ? 'text-emerald-700'
                            : item.sentiment === 'Negative'
                              ? 'text-red-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {item.sentiment}
                      </span>
                      <div className="text-[11px] text-slate-500">{item.category}</div>
                    </td>
                    <td className="py-3 text-right align-top font-mono tabular-nums text-[#173650]">
                      {item.rating}/5
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { NavModuleId } from '../types';

interface DashboardData {
  kpis: {
    totalDocuments: number;
    totalFeedback: number;
    simulatedFeedback: number;
    totalCompetitors: number;
    totalOpportunities: number;
    activeCampaigns: number;
    totalReports: number;
  };
  salesTrend: Array<{ month: string; volumeMt: number; revenueLakhs: number; isSimulated: boolean }>;
  categoryMix: Array<{ category: string; volumeMt: number; revenueLakhs: number }>;
  sentimentDistribution: Array<{ sentiment: string; count: number }>;
  topOpportunities: Array<{
    id: string;
    title: string;
    stateName: string;
    cityName: string;
    opportunityScore: string;
    productCategoryName: string;
    isSimulated: boolean;
  }>;
  campaignPerformance: Array<{
    id: string;
    name: string;
    status: string;
    isSimulated: boolean;
    leads: number;
    conversions: number;
    avgRoi: number;
  }>;
  recentAi: Array<{
    id: string;
    module: string;
    prompt: string;
    response: string;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    userEmail: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
}

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#249B91',
  Neutral: '#4A89B8',
  Negative: '#DC2626',
};

export function DashboardPage({ onNavigate }: { onNavigate: (id: NavModuleId) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 h-80 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-lg p-6 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Dashboard Load Error</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-md bg-[#173650] text-white text-xs font-medium cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Uploaded Market Reports', value: data.kpis.totalDocuments, target: 'knowledge' as NavModuleId },
    { label: 'Customer Feedback Records', value: data.kpis.totalFeedback, target: 'customers' as NavModuleId },
    { label: 'Competitor Profiles', value: data.kpis.totalCompetitors, target: 'competitors' as NavModuleId },
    { label: 'Market Opportunities', value: data.kpis.totalOpportunities, target: 'regional' as NavModuleId },
    { label: 'Active Campaigns', value: data.kpis.activeCampaigns, target: 'campaigns' as NavModuleId },
    { label: 'Reports Generated', value: data.kpis.totalReports, target: 'reports' as NavModuleId },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#173650]">Executive Marketing Dashboard</h1>
          <p className="text-sm text-slate-600">
            Live KPIs calculated from PostgreSQL records · Baseline seed records labeled as simulated
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* 6 Database-Driven KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.target)}
            className="bg-white border border-slate-200 hover:border-[#4A89B8] rounded-lg p-4 text-left transition-colors cursor-pointer"
          >
            <div className="text-xs text-slate-500 truncate">{card.label}</div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#173650]">
              {card.value}
            </div>
          </button>
        ))}
      </div>

      {/* Charts Row 1: Market Demand Trend & Product Category Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#173650]">Market Demand Trend (MT)</h2>
              <p className="text-xs text-slate-500">Monthly volume across India regions · Simulated baseline data</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Line type="monotone" dataKey="volumeMt" name="Volume (MT)" stroke="#173650" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="revenueLakhs" name="Revenue (INR Lakhs)" stroke="#249B91" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#173650]">Product Category Volume Mix</h2>
              <p className="text-xs text-slate-500">Metric tonnes by paper & packaging grade · Simulated baseline</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryMix} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="category" width={135} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip />
                <Bar dataKey="volumeMt" name="Volume (MT)" fill="#4A89B8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Charts Row 2: Customer Sentiment & Regional Opportunity Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-[#173650]">Customer Sentiment Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">
            Calculated from {data.kpis.totalFeedback} records ({data.kpis.simulatedFeedback} simulated baseline)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.sentimentDistribution}
                  dataKey="count"
                  nameKey="sentiment"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {data.sentimentDistribution.map((entry) => (
                    <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment] || '#64748B'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5 text-xs text-slate-600 mt-1">
            {data.sentimentDistribution.map((s) => (
              <span key={s.sentiment} className="font-mono tabular-nums">
                {s.sentiment}: {s.count}
              </span>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#173650]">Top Regional Opportunities</h2>
              <p className="text-xs text-slate-500">Weighted opportunity scores across Indian commercial hubs</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('regional')}
              className="text-xs font-medium text-[#249B91] hover:underline cursor-pointer"
            >
              Open Regional Finder
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topOpportunities}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="stateName" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="opportunityScore" name="Opportunity Score" fill="#249B91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom Row: Campaign Performance, Recent AI Recommendations, Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-[#173650] mb-3">Campaign Performance</h2>
          {data.campaignPerformance.length === 0 ? (
            <p className="text-xs text-slate-500">No campaigns recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.campaignPerformance.map((c) => (
                <div key={c.id} className="py-2.5">
                  <div className="text-xs font-semibold text-[#173650] truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                    Status: {c.status} · Leads: {c.leads} · ROI: {c.avgRoi}% {c.isSimulated ? '· Simulated' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-[#173650] mb-3">Recent AI Recommendations</h2>
          {data.recentAi.length === 0 ? (
            <div className="text-xs text-slate-500 space-y-2">
              <p>No AI analyses executed yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="text-[#249B91] font-medium hover:underline cursor-pointer"
              >
                Run Market Intelligence Analysis
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentAi.map((item) => (
                <div key={item.id} className="py-2.5">
                  <div className="text-[11px] text-slate-500">
                    {item.module} · {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs font-medium text-[#173650] truncate mt-0.5">{item.prompt}</div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{item.response}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-[#173650] mb-3">Recent Platform Activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500">Audit events will appear as actions are recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentActivity.map((act) => (
                <div key={act.id} className="py-2">
                  <div className="text-xs font-medium text-[#173650]">{act.action}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {act.userEmail} · {act.entityType} · {new Date(act.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

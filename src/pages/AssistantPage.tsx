import React, { useEffect, useState } from 'react';
import { Bot, FileOutput, Send } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import type { AiInteractionRecord, NavModuleId } from '../types';

const SUGGESTED_PROMPTS = [
  'What are the biggest customer complaints about our products?',
  'Compare ITC PSPD and Tamil Nadu Newsprint & Papers.',
  'Which regions show the strongest packaging board opportunity?',
  'Summarise the latest uploaded market research reports.',
  'What marketing opportunities can we explore in the FMCG segment?',
];

export function AssistantPage({ onNavigate }: { onNavigate: (id: NavModuleId) => void }) {
  const { addToast } = useToast();
  const [history, setHistory] = useState<AiInteractionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await apiRequest<{ history: AiInteractionRecord[] }>('/api/assistant/history');
      setHistory(res.history);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load history', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const submitQuery = async (promptText: string) => {
    if (promptText.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ interaction: AiInteractionRecord }>('/api/assistant/query', {
        method: 'POST',
        body: { query: promptText.trim() },
      });
      setHistory((prev) => [res.interaction, ...prev]);
      setQuery('');
    } catch (err) {
      addToast({ type: 'error', title: 'Assistant Error', message: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  const exportToReport = async (item: AiInteractionRecord) => {
    try {
      await apiRequest('/api/reports/from-assistant', {
        method: 'POST',
        body: {
          prompt: item.prompt,
          response: item.response,
          citations: item.citations,
          assumptions: item.assumptions,
          reasoning: item.reasoning,
        },
      });
      addToast({ type: 'success', title: 'Exported to Marketing Report Generator' });
      onNavigate('reports');
    } catch (err) {
      addToast({ type: 'error', title: 'Export Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">AI Marketing Assistant</h1>
        <p className="text-sm text-slate-600">
          Retrieval-Augmented assistant grounded in Knowledge Hub documents and live PostgreSQL business data.
        </p>
      </div>

      {/* Prompt Input & Quick Queries */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuery(query);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about customer complaints, competitor gaps, regional demand, or uploaded reports..."
            className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-md"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="px-5 py-2.5 rounded-md bg-[#173650] hover:bg-[#1E4566] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Synthesizing...' : 'Ask Assistant'}</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => submitQuery(p)}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-[#F8FAFC] hover:border-[#249B91] text-xs text-slate-700 cursor-pointer text-left"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Conversation & Citations Stream */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
            <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-[#173650]">Ask your first intelligence question</p>
            <p className="text-xs text-slate-500 mt-1">
              Answers automatically cite retrieved documents, state explicit assumptions, and allow one-click export to reports.
            </p>
          </div>
        ) : (
          history.map((item) => (
            <article key={item.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                  <h2 className="text-base font-semibold text-[#173650] mt-0.5">{item.prompt}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => exportToReport(item)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#173650] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileOutput className="w-3.5 h-3.5" />
                  <span>Export to Report</span>
                </button>
              </div>

              <p className="text-sm text-[#1A2530] leading-relaxed whitespace-pre-line">{item.response}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <h3 className="font-semibold text-[#249B91] mb-1.5">Source Citations ({item.citations.length})</h3>
                  {item.citations.length === 0 ? (
                    <p className="text-slate-500">No external document excerpts cited.</p>
                  ) : (
                    <ul className="space-y-2">
                      {item.citations.map((c, idx) => (
                        <li key={idx} className="text-slate-700">
                          <div className="font-medium text-[#173650]">
                            {c.source} · {c.pageOrSection}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-2">{c.excerpt}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-[#173650] mb-1.5">Explicit Assumptions</h3>
                  {item.assumptions.length === 0 ? (
                    <p className="text-slate-500">None noted.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-600">
                      {item.assumptions.map((a, idx) => <li key={idx}>• {a}</li>)}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-[#4A89B8] mb-1.5">Analytical Reasoning</h3>
                  <p className="text-slate-600">{item.reasoning || 'Synthesized from retrieved context and authorized database records.'}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

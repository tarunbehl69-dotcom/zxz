import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  campaigns,
  competitors,
  customerFeedback,
  documents,
  opportunities,
  regions,
  reports,
} from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';
import { retrieveRelevantChunks } from './knowledge.ts';

export const reportsRouter = Router();

reportsRouter.get('/reports', requireAuth, requirePermission('report:read'), async (_req, res) => {
  try {
    const list = await db.select().from(reports).orderBy(desc(reports.createdAt));
    res.json({ reports: list });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: 'Failed to load reports.' });
  }
});

reportsRouter.post('/reports/generate', requireAuth, requirePermission('report:write'), async (req: AuthRequest, res) => {
  try {
    assertGeminiConfigured();
    const { category, title, customScope } = req.body as {
      category?: string;
      title?: string;
      customScope?: string;
    };

    const reportCategory = category || 'Executive marketing report';

    // Gather live database evidence
    const [docs, feedback, comps, opps, camps, regionList, ragChunks] = await Promise.all([
      db.select({ title: documents.title, fileName: documents.fileName, category: documents.category }).from(documents).limit(10),
      db.select().from(customerFeedback).orderBy(desc(customerFeedback.createdAt)).limit(25),
      db.select().from(competitors).limit(10),
      db.select().from(opportunities).orderBy(desc(opportunities.opportunityScore)).limit(10),
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(10),
      db.select().from(regions).limit(10),
      retrieveRelevantChunks(`${reportCategory} ${customScope || 'paper and packaging market strategy'}`, 5),
    ]);

    const sentimentStats = {
      positive: feedback.filter((f) => f.sentiment === 'Positive').length,
      neutral: feedback.filter((f) => f.sentiment === 'Neutral').length,
      negative: feedback.filter((f) => f.sentiment === 'Negative').length,
    };

    const dbSnapshot = `
LIVE DATABASE SNAPSHOT:
- Indexed Knowledge Documents (${docs.length}): ${docs.map((d) => `${d.title} (${d.fileName})`).join(', ') || 'None'}
- Customer Feedback Records (${feedback.length}): Positive=${sentimentStats.positive}, Neutral=${sentimentStats.neutral}, Negative=${sentimentStats.negative}
  Sample feedback: ${feedback.slice(0, 6).map((f) => `[${f.productName} | ${f.regionName} | ${f.sentiment}] ${f.feedbackText}`).join(' || ')}
- Competitor Profiles (${comps.length}): ${comps.map((c) => `${c.name} (Source: ${c.sourceName}, ${c.sourceDate})`).join(', ')}
- Regional Opportunities (${opps.length}): ${opps.slice(0, 5).map((o) => `${o.title}: Score ${o.opportunityScore}`).join(' | ')}
- Regions Covered: ${regionList.map((r) => `${r.stateName} (${r.dealerCount} dealers)`).join(', ')}
- Campaigns (${camps.length}): ${camps.map((c) => `${c.name} [${c.status}] Budget INR ${c.budgetInr}`).join(' | ')}

KNOWLEDGE HUB CITATIONS:
${ragChunks.map((c) => `[${c.documentTitle}, Page ${c.pageNumber}]: ${c.content}`).join('\n\n') || 'None retrieved.'}
`;

    const prompt = `
Generate a board-ready ${reportCategory} for executive marketing leadership.
Custom Scope: ${customScope || 'Comprehensive synthesis across available live database records and Knowledge Hub documents.'}

${dbSnapshot}

Ensure all 10 required sections are populated accurately. For chartData, provide 4-6 meaningful quantitative data points directly derived from the live snapshot above (e.g. sentiment counts, opportunity scores, or regional dealer counts).
`;

    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            objective: { type: Type.STRING },
            methodology: { type: Type.STRING },
            dataSources: { type: Type.ARRAY, items: { type: Type.STRING } },
            analysis: { type: Type.STRING },
            chartData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                },
                required: ['label', 'value', 'unit'],
              },
            },
            keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'title',
            'executiveSummary',
            'objective',
            'methodology',
            'dataSources',
            'analysis',
            'chartData',
            'keyFindings',
            'recommendations',
            'assumptions',
            'limitations',
          ],
        },
      },
    });

    const parsed = JSON.parse((resp.text || '{}').trim());

    const [saved] = await db
      .insert(reports)
      .values({
        title: title?.trim() || parsed.title || `${reportCategory} — ${new Date().toISOString().slice(0, 10)}`,
        category: reportCategory,
        executiveSummary: parsed.executiveSummary || '',
        objective: parsed.objective || '',
        methodology: parsed.methodology || '',
        dataSources: parsed.dataSources || [],
        analysis: parsed.analysis || '',
        chartData: parsed.chartData || [],
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || [],
        assumptions: parsed.assumptions || [],
        limitations: parsed.limitations || [],
        generatedBy: req.user?.id ?? null,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'REPORT_GENERATED',
      entityType: 'report',
      entityId: saved.id,
      details: { category: saved.category, title: saved.title },
    });

    res.status(201).json({ report: saved });
  } catch (error: unknown) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate report.' });
  }
});

reportsRouter.post('/reports/from-assistant', requireAuth, requirePermission('report:write'), async (req: AuthRequest, res) => {
  try {
    const { prompt, response, citations, assumptions, reasoning } = req.body as {
      prompt?: string;
      response?: string;
      citations?: Array<{ source: string; pageOrSection: string }>;
      assumptions?: string[];
      reasoning?: string;
    };

    if (!prompt || !response) {
      res.status(400).json({ error: 'Assistant prompt and response are required.' });
      return;
    }

    const [saved] = await db
      .insert(reports)
      .values({
        title: `AI Intelligence Brief: ${prompt.slice(0, 72)}`,
        category: 'Executive marketing report',
        executiveSummary: response,
        objective: `Respond to executive query: "${prompt}"`,
        methodology: reasoning || 'Retrieval-Augmented Generation (pgvector + Gemini) combined with authorized PostgreSQL business intelligence queries.',
        dataSources: (citations || []).map((c) => `${c.source} (${c.pageOrSection})`),
        analysis: response,
        chartData: [],
        keyFindings: [response.split('. ')[0] || response],
        recommendations: ['Review cited source documents before final commercial allocation.'],
        assumptions: assumptions || ['Based strictly on authorized records available at time of query.'],
        limitations: ['Exported directly from conversational AI Intelligence Assistant session.'],
        generatedBy: req.user?.id ?? null,
      })
      .returning();

    res.status(201).json({ report: saved });
  } catch (error) {
    console.error('Export assistant to report error:', error);
    res.status(500).json({ error: 'Failed to export assistant response to report.' });
  }
});

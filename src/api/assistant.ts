import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiInteractions,
  campaigns,
  competitorProducts,
  competitors,
  customerFeedback,
  documents,
  opportunities,
  regions,
} from '../db/schema.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';
import { retrieveRelevantChunks } from './knowledge.ts';

export const assistantRouter = Router();

assistantRouter.get('/assistant/history', requireAuth, requirePermission('assistant:use'), async (req: AuthRequest, res) => {
  try {
    const history = await db
      .select()
      .from(aiInteractions)
      .where(eq(aiInteractions.module, 'assistant'))
      .orderBy(desc(aiInteractions.createdAt))
      .limit(20);
    res.json({ history });
  } catch (error) {
    console.error('Assistant history error:', error);
    res.status(500).json({ error: 'Failed to load assistant history.' });
  }
});

assistantRouter.post('/assistant/query', requireAuth, requirePermission('assistant:use'), async (req: AuthRequest, res) => {
  try {
    assertGeminiConfigured();
    const { query } = req.body as { query?: string };
    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Please enter a question for the AI Marketing Assistant.' });
      return;
    }

    const userQuery = query.trim();

    // Parallel retrieval: semantic RAG chunks + authorized DB records
    const [chunks, feedbackRows, compRows, compProdRows, oppRows, regionRows, campRows, docRows] =
      await Promise.all([
        retrieveRelevantChunks(userQuery, 6),
        db.select().from(customerFeedback).orderBy(desc(customerFeedback.createdAt)).limit(25),
        db.select().from(competitors),
        db.select().from(competitorProducts),
        db.select().from(opportunities).orderBy(desc(opportunities.opportunityScore)).limit(8),
        db.select().from(regions),
        db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(6),
        db.select({ title: documents.title, fileName: documents.fileName, rawSummary: documents.rawSummary }).from(documents).limit(10),
      ]);

    const ragSection =
      chunks.length > 0
        ? chunks
            .map(
              (c, idx) =>
                `[DOC-${idx + 1}] Source: "${c.documentTitle}" (${c.fileName}), ${c.sectionTitle}, Page ${c.pageNumber}\nExcerpt: ${c.content}`
            )
            .join('\n\n')
        : 'No matching chunks found in Knowledge Hub documents.';

    const businessDataSection = `
AUTHORIZED DATABASE RECORDS:
1. Uploaded Documents (${docRows.length}):
${docRows.map((d) => `- ${d.title} (${d.fileName}): ${d.rawSummary || 'Indexed'}`).join('\n') || 'None'}

2. Customer Feedback (${feedbackRows.length} recent records):
${feedbackRows
  .map(
    (f) =>
      `- [${f.productName} | ${f.regionName} | ${f.industry} | ${f.sentiment} ${f.rating}/5 | Category: ${f.category}${f.isSimulated ? ' | Simulated Baseline' : ''}]: "${f.feedbackText}" | Pain points: ${(f.painPoints || []).join(', ') || 'None'}`
  )
  .join('\n') || 'None'}

3. Competitors (${compRows.length}):
${compRows
  .map((c) => {
    const prods = compProdRows.filter((p) => p.competitorId === c.id);
    return `- ${c.name} (Source: ${c.sourceName}, Date: ${c.sourceDate}, Status: ${c.verificationStatus}): Positioning: ${c.marketPositioning} | Sustainability: ${c.sustainabilityClaims} | Products: ${prods.map((p) => `${p.productName} (${p.gsmRange}, INR ${p.pricePerMtInr || 'Unverified'}/MT)`).join('; ')}`;
  })
  .join('\n') || 'None'}

4. Regional Opportunities & Regions:
${oppRows.map((o) => `- ${o.title}: Score ${o.opportunityScore}/100 (${o.rationale})`).join('\n') || 'None'}
Regions: ${regionRows.map((r) => `${r.stateName} (${r.cityName}): Demand ${r.demandPotentialScore}, Growth ${r.salesGrowthScore}, Dealers ${r.dealerCount}`).join(' | ')}

5. Campaigns:
${campRows.map((c) => `- ${c.name} [${c.status}]: ${c.productName} in ${c.region}, Budget INR ${c.budgetInr}`).join('\n') || 'None'}
`;

    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `USER QUESTION: ${userQuery}\n\nRETRIEVED KNOWLEDGE HUB CHUNKS:\n${ragSection}\n\n${businessDataSection}\n\nAnswer concisely in executive business language. Cite exact document names/pages or database tables in citations. Explicitly list assumptions and explain your reasoning.`,
      config: {
        systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  pageOrSection: { type: Type.STRING },
                  excerpt: { type: Type.STRING },
                },
                required: ['source', 'pageOrSection', 'excerpt'],
              },
            },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING },
          },
          required: ['answer', 'citations', 'assumptions', 'reasoning'],
        },
      },
    });

    const parsed = JSON.parse((resp.text || '{}').trim());

    const [saved] = await db
      .insert(aiInteractions)
      .values({
        userId: req.user?.id ?? null,
        module: 'assistant',
        prompt: userQuery,
        response: parsed.answer || '',
        citations: parsed.citations || [],
        assumptions: parsed.assumptions || [],
        reasoning: parsed.reasoning || '',
      })
      .returning();

    res.json({ interaction: saved });
  } catch (error: unknown) {
    console.error('Assistant query error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Assistant query failed.' });
  }
});

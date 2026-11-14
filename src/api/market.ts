import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiInteractions,
  markets,
  productCategories,
  products,
  regions,
  systemSettings,
} from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';
import { retrieveRelevantChunks } from './knowledge.ts';

export const marketRouter = Router();

marketRouter.get('/market/taxonomy', requireAuth, requirePermission('market:read'), async (_req, res) => {
  try {
    const [categories, productList, marketList, regionList, industrySetting] = await Promise.all([
      db.select().from(productCategories).orderBy(productCategories.name),
      db.select().from(products).orderBy(products.name),
      db.select().from(markets).orderBy(markets.name),
      db.select().from(regions).orderBy(regions.stateName),
      db.select().from(systemSettings).where(eq(systemSettings.key, 'industry_categories')).limit(1),
    ]);

    const industries =
      (industrySetting[0]?.value?.items as string[] | undefined) || [
        'Printing',
        'Publishing',
        'Education',
        'FMCG',
        'Pharmaceuticals',
        'Food & Beverage',
        'Packaging',
      ];

    res.json({
      productCategories: categories,
      products: productList,
      markets: marketList,
      regions: regionList,
      industries,
    });
  } catch (error) {
    console.error('Taxonomy fetch error:', error);
    res.status(500).json({ error: 'Failed to load market taxonomy.' });
  }
});

marketRouter.post('/market/categories', requireAuth, requirePermission('settings:manage'), async (req: AuthRequest, res) => {
  try {
    const { name, code, description } = req.body as {
      name?: string;
      code?: string;
      description?: string;
    };
    if (!name?.trim() || !code?.trim()) {
      res.status(400).json({ error: 'Category name and code are required.' });
      return;
    }

    const [created] = await db
      .insert(productCategories)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim() || `${name.trim()} portfolio segment.`,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'PRODUCT_CATEGORY_CREATED',
      entityType: 'product_category',
      entityId: created.id,
      details: { name: created.name, code: created.code },
    });

    res.status(201).json({ category: created });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(400).json({ error: 'Failed to create product category (name or code may already exist).' });
  }
});

marketRouter.post('/market/analyze', requireAuth, requirePermission('market:analyze'), async (req: AuthRequest, res) => {
  try {
    assertGeminiConfigured();
    const { productCategory, industry, region, focusQuestion } = req.body as {
      productCategory?: string;
      industry?: string;
      region?: string;
      focusQuestion?: string;
    };

    const selectedCategory = productCategory || 'Packaging Boards';
    const selectedIndustry = industry || 'FMCG';
    const selectedRegion = region || 'All India';

    const queryString = `${selectedCategory} ${selectedIndustry} ${selectedRegion} ${focusQuestion || 'demand drivers market trends paper packaging'}`;
    const chunks = await retrieveRelevantChunks(queryString, 6, { productCategory: selectedCategory });

    const contextBlock =
      chunks.length > 0
        ? chunks
            .map(
              (c, i) =>
                `[Source ${i + 1}: ${c.documentTitle} (${c.fileName}), ${c.sectionTitle}, Page ${c.pageNumber}]\n${c.content}`
            )
            .join('\n\n---\n\n')
        : 'NO UPLOADED KNOWLEDGE HUB DOCUMENTS MATCHED THIS QUERY.';

    const prompt = `
Perform a Paper & Packaging Market Intelligence analysis for:
- Product Category: ${selectedCategory}
- Target Customer Industry: ${selectedIndustry}
- Geographical Region: ${selectedRegion}
- Focus Question: ${focusQuestion || 'Analyze demand trends, key drivers, and growth opportunities.'}

RETRIEVED KNOWLEDGE HUB EXCERPTS:
${contextBlock}

Return structured JSON clearly separating Sourced Facts (with exact citations from the excerpts above; if no excerpts match, state that no uploaded document facts were found), Explicit Assumptions, Demand Drivers, Opportunity Assessments, and Strategic Recommendations.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveOverview: { type: Type.STRING },
            sourcedFacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fact: { type: Type.STRING },
                  citation: { type: Type.STRING },
                },
                required: ['fact', 'citation'],
              },
            },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            demandDrivers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  driver: { type: Type.STRING },
                  impactLevel: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['driver', 'impactLevel', 'explanation'],
              },
            },
            opportunityAssessments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  segment: { type: Type.STRING },
                  potential: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ['segment', 'potential', 'rationale'],
              },
            },
            strategicRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'executiveOverview',
            'sourcedFacts',
            'assumptions',
            'demandDrivers',
            'opportunityAssessments',
            'strategicRecommendations',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());

    await db.insert(aiInteractions).values({
      userId: req.user?.id ?? null,
      module: 'market_intelligence',
      prompt: `${selectedCategory} · ${selectedIndustry} · ${selectedRegion}${focusQuestion ? `: ${focusQuestion}` : ''}`,
      response: parsed.executiveOverview || '',
      citations: chunks.map((c) => ({
        source: c.documentTitle,
        pageOrSection: `${c.sectionTitle} (p.${c.pageNumber})`,
        excerpt: c.content.slice(0, 180),
      })),
      assumptions: parsed.assumptions || [],
      reasoning: `Analyzed ${chunks.length} Knowledge Hub chunk(s) for ${selectedCategory} in ${selectedIndustry}.`,
    });

    res.json({
      analysis: parsed,
      retrievedChunksCount: chunks.length,
    });
  } catch (error: unknown) {
    console.error('Market analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run market intelligence analysis.',
    });
  }
});

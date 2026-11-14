import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { competitorProducts, competitors, documentChunks, documents, products } from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';

export const competitorsRouter = Router();

competitorsRouter.get('/competitors', requireAuth, requirePermission('competitor:read'), async (_req, res) => {
  try {
    const [compList, compProds, jkProds] = await Promise.all([
      db.select().from(competitors).orderBy(competitors.name),
      db.select().from(competitorProducts).orderBy(competitorProducts.productName),
      db.select().from(products).orderBy(products.name),
    ]);
    res.json({
      competitors: compList,
      competitorProducts: compProds,
      jkProducts: jkProds,
    });
  } catch (error) {
    console.error('Fetch competitors error:', error);
    res.status(500).json({ error: 'Failed to load competitor intelligence.' });
  }
});

competitorsRouter.post('/competitors', requireAuth, requirePermission('competitor:write'), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      headquarters,
      marketPositioning,
      sustainabilityClaims,
      strengths,
      weaknesses,
      website,
      sourceName,
      sourceDate,
      verificationStatus,
    } = req.body as {
      name?: string;
      headquarters?: string;
      marketPositioning?: string;
      sustainabilityClaims?: string;
      strengths?: string[];
      weaknesses?: string[];
      website?: string;
      sourceName?: string;
      sourceDate?: string;
      verificationStatus?: string;
    };

    if (!name?.trim() || !sourceName?.trim() || !sourceDate?.trim()) {
      res.status(400).json({ error: 'Competitor name, source name, and source date are mandatory for verification.' });
      return;
    }

    const [created] = await db
      .insert(competitors)
      .values({
        name: name.trim(),
        headquarters: headquarters?.trim() || 'India',
        marketPositioning: marketPositioning?.trim() || 'Not documented in source.',
        sustainabilityClaims: sustainabilityClaims?.trim() || 'Not documented in source.',
        strengths: Array.isArray(strengths) ? strengths : [],
        weaknesses: Array.isArray(weaknesses) ? weaknesses : [],
        website: website?.trim() || null,
        sourceName: sourceName.trim(),
        sourceDate: sourceDate.trim(),
        verificationStatus: verificationStatus || 'Pending Review',
        isSimulated: false,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'COMPETITOR_CREATED',
      entityType: 'competitor',
      entityId: created.id,
      details: { name: created.name, sourceName: created.sourceName },
    });

    res.status(201).json({ competitor: created });
  } catch (error) {
    console.error('Create competitor error:', error);
    res.status(400).json({ error: 'Failed to save competitor profile (name may already exist).' });
  }
});

competitorsRouter.post(
  '/competitors/:id/products',
  requireAuth,
  requirePermission('competitor:write'),
  async (req: AuthRequest, res) => {
    try {
      const competitorId = String(req.params.id);
      const {
        categoryName,
        productName,
        gsmRange,
        brightness,
        pricePerMtInr,
        sustainabilityCert,
        sourceName,
        sourceDate,
        verificationStatus,
      } = req.body as {
        categoryName?: string;
        productName?: string;
        gsmRange?: string;
        brightness?: string;
        pricePerMtInr?: string | number | null;
        sustainabilityCert?: string;
        sourceName?: string;
        sourceDate?: string;
        verificationStatus?: string;
      };

      if (!productName?.trim() || !sourceName?.trim() || !sourceDate?.trim()) {
        res.status(400).json({ error: 'Product name, source name, and source date are mandatory.' });
        return;
      }

      const [created] = await db
        .insert(competitorProducts)
        .values({
          competitorId,
          categoryName: categoryName?.trim() || 'Packaging Boards',
          productName: productName.trim(),
          gsmRange: gsmRange?.trim() || 'Unverified in source',
          brightness: brightness?.trim() || 'Unverified in source',
          pricePerMtInr: pricePerMtInr ? Number(pricePerMtInr).toFixed(2) : null,
          sustainabilityCert: sustainabilityCert?.trim() || 'Unverified in source',
          sourceName: sourceName.trim(),
          sourceDate: sourceDate.trim(),
          verificationStatus: verificationStatus || 'Pending Review',
          isSimulated: false,
        })
        .returning();

      await logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email || 'unknown',
        action: 'COMPETITOR_PRODUCT_ADDED',
        entityType: 'competitor_product',
        entityId: created.id,
        details: { productName: created.productName, sourceName: created.sourceName },
      });

      res.status(201).json({ competitorProduct: created });
    } catch (error) {
      console.error('Add competitor product error:', error);
      res.status(400).json({ error: 'Failed to add competitor product.' });
    }
  }
);

competitorsRouter.post(
  '/competitors/extract-from-document',
  requireAuth,
  requirePermission('competitor:write'),
  async (req: AuthRequest, res) => {
    try {
      assertGeminiConfigured();
      const { documentId } = req.body as { documentId?: string };
      if (!documentId) {
        res.status(400).json({ error: 'documentId is required.' });
        return;
      }

      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const chunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, documentId))
        .orderBy(documentChunks.chunkIndex)
        .limit(10);

      const text = chunks.map((c) => `[Page ${c.pageNumber}] ${c.content}`).join('\n\n');

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract ONLY explicitly stated competitor profiles and products from "${doc.fileName}".
STRICT RULE: NEVER fabricate or estimate pricing, GSM, brightness, or market share. Leave missing numeric prices null and missing strings as "Not stated in source".

DOCUMENT TEXT:
${text}`,
        config: {
          systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              competitorName: { type: Type.STRING },
              headquarters: { type: Type.STRING },
              marketPositioning: { type: Type.STRING },
              sustainabilityClaims: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              products: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING },
                    categoryName: { type: Type.STRING },
                    gsmRange: { type: Type.STRING },
                    brightness: { type: Type.STRING },
                    pricePerMtInr: { type: Type.NUMBER, nullable: true },
                    sustainabilityCert: { type: Type.STRING },
                  },
                  required: ['productName', 'categoryName', 'gsmRange', 'brightness', 'sustainabilityCert'],
                },
              },
            },
            required: ['competitorName', 'marketPositioning', 'sustainabilityClaims', 'products'],
          },
        },
      });

      const extracted = JSON.parse((resp.text || '{}').trim());
      res.json({
        extracted,
        sourceName: `${doc.title} (${doc.fileName})`,
        sourceDate: new Date().toISOString().slice(0, 10),
      });
    } catch (error: unknown) {
      console.error('Competitor extraction error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Extraction failed.' });
    }
  }
);

competitorsRouter.post(
  '/competitors/gap-analysis',
  requireAuth,
  requirePermission('competitor:read'),
  async (req, res) => {
    try {
      assertGeminiConfigured();
      const { competitorIds } = req.body as { competitorIds?: string[] };
      const allComps = await db.select().from(competitors).orderBy(desc(competitors.updatedAt));
      const selected =
        competitorIds && competitorIds.length > 0
          ? allComps.filter((c) => competitorIds.includes(c.id))
          : allComps.slice(0, 2);

      if (selected.length === 0) {
        res.status(400).json({ error: 'Select at least one competitor to analyze.' });
        return;
      }

      const compProds = await db.select().from(competitorProducts);
      const jkProds = await db.select().from(products);

      const context = selected
        .map((c) => {
          const prods = compProds.filter((p) => p.competitorId === c.id);
          return `COMPETITOR: ${c.name} (Source: ${c.sourceName}, Date: ${c.sourceDate}, Status: ${c.verificationStatus})
Positioning: ${c.marketPositioning}
Sustainability: ${c.sustainabilityClaims}
Strengths: ${c.strengths.join('; ')}
Weaknesses: ${c.weaknesses.join('; ')}
Products: ${prods.map((p) => `${p.productName} (${p.categoryName}, ${p.gsmRange}, ${p.brightness}, INR/MT: ${p.pricePerMtInr || 'Unverified'})`).join(' | ')}`;
        })
        .join('\n\n');

      const portfolioContext = jkProds
        .map((p) => `${p.name} (${p.gsmRange}, ${p.brightness}, ${p.sustainabilityCert})`)
        .join(' | ');

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Compare the selected competitors against our paper & packaging product portfolio strictly using the verified records below. Identify competitive gaps, positioning advantages, and marketing counter-moves without fabricating any pricing or specs.\n\nOUR PRODUCT PORTFOLIO:\n${portfolioContext}\n\nCOMPETITOR RECORDS:\n${context}`,
        config: {
          systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveComparison: { type: Type.STRING },
              competitiveGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              portfolioAdvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedCounterMoves: { type: Type.ARRAY, items: { type: Type.STRING } },
              dataLimitations: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'executiveComparison',
              'competitiveGaps',
              'portfolioAdvantages',
              'recommendedCounterMoves',
              'dataLimitations',
            ],
          },
        },
      });

      res.json(JSON.parse((resp.text || '{}').trim()));
    } catch (error: unknown) {
      console.error('Gap analysis error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run gap analysis.' });
    }
  }
);

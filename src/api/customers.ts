import crypto from 'node:crypto';
import { Router } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import { desc, inArray } from 'drizzle-orm';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db } from '../db/index.ts';
import { customerFeedback, customers } from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function computeDedupHash(customerName: string, productName: string, feedbackText: string): string {
  const normalized = `${customerName.trim().toLowerCase()}|${productName.trim().toLowerCase()}|${feedbackText.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function analyzeFeedbackWithAI(
  items: Array<{ feedbackText: string; rating: number }>
): Promise<
  Array<{
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    sentimentScore: number;
    category: string;
    painPoints: string[];
    requestedFeatures: string[];
    priceSensitivity: 'High' | 'Medium' | 'Low';
  }>
> {
  if (process.env.GEMINI_API_KEY && items.length > 0) {
    try {
      const prompt = `Classify these ${items.length} B2B paper/packaging customer feedback entries:\n${items
        .map((it, idx) => `[${idx}] (Rating ${it.rating}/5): ${it.feedbackText}`)
        .join('\n')}`;

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sentiment: { type: Type.STRING },
                sentimentScore: { type: Type.NUMBER },
                category: { type: Type.STRING },
                painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                requestedFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
                priceSensitivity: { type: Type.STRING },
              },
              required: ['sentiment', 'sentimentScore', 'category', 'painPoints', 'requestedFeatures', 'priceSensitivity'],
            },
          },
        },
      });
      const parsed = JSON.parse((resp.text || '[]').trim());
      if (Array.isArray(parsed) && parsed.length === items.length) {
        return parsed.map((p) => ({
          sentiment: p.sentiment === 'Positive' || p.sentiment === 'Negative' ? p.sentiment : 'Neutral',
          sentimentScore: Math.max(-1, Math.min(1, Number(p.sentimentScore) || 0)),
          category: p.category || 'Quality',
          painPoints: Array.isArray(p.painPoints) ? p.painPoints : [],
          requestedFeatures: Array.isArray(p.requestedFeatures) ? p.requestedFeatures : [],
          priceSensitivity: p.priceSensitivity === 'High' || p.priceSensitivity === 'Low' ? p.priceSensitivity : 'Medium',
        }));
      }
    } catch (err) {
      console.warn('Gemini feedback classification fallback used:', err);
    }
  }

  return items.map((it) => {
    const lower = it.feedbackText.toLowerCase();
    const sentiment: 'Positive' | 'Neutral' | 'Negative' =
      it.rating >= 4 ? 'Positive' : it.rating <= 2 ? 'Negative' : 'Neutral';
    const score = it.rating >= 4 ? 0.75 : it.rating <= 2 ? -0.6 : 0.05;
    const category = lower.includes('price') || lower.includes('cost')
      ? 'Pricing'
      : lower.includes('delay') || lower.includes('dispatch') || lower.includes('delivery')
        ? 'Delivery'
        : lower.includes('pack') || lower.includes('carton')
          ? 'Packaging'
          : lower.includes('eco') || lower.includes('fsc') || lower.includes('plastic')
            ? 'Sustainability'
            : 'Quality';
    return {
      sentiment,
      sentimentScore: score,
      category,
      painPoints: sentiment === 'Negative' ? [it.feedbackText.slice(0, 80)] : [],
      requestedFeatures: [],
      priceSensitivity: lower.includes('price') || lower.includes('rate') ? 'High' : 'Medium',
    };
  });
}

export const customersRouter = Router();

customersRouter.get('/customers', requireAuth, requirePermission('customer:read'), async (_req, res) => {
  try {
    const [customerList, feedbackList] = await Promise.all([
      db.select().from(customers).orderBy(desc(customers.createdAt)),
      db.select().from(customerFeedback).orderBy(desc(customerFeedback.createdAt)),
    ]);

    // Quantitative aggregations strictly computed from actual DB records
    const total = feedbackList.length;
    const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    const categoryCounts: Record<string, number> = {};
    const productCounts: Record<string, { count: number; totalRating: number }> = {};
    const regionalCounts: Record<string, { count: number; positive: number; negative: number; totalRating: number }> = {};
    const priceSensitivityCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    const painPointFreq: Record<string, number> = {};
    const featureFreq: Record<string, number> = {};
    let ratingSum = 0;

    for (const fb of feedbackList) {
      ratingSum += fb.rating;
      if (fb.sentiment === 'Positive') sentimentCounts.Positive++;
      else if (fb.sentiment === 'Negative') sentimentCounts.Negative++;
      else sentimentCounts.Neutral++;

      categoryCounts[fb.category] = (categoryCounts[fb.category] || 0) + 1;
      priceSensitivityCounts[fb.priceSensitivity] = (priceSensitivityCounts[fb.priceSensitivity] || 0) + 1;

      if (!productCounts[fb.productName]) productCounts[fb.productName] = { count: 0, totalRating: 0 };
      productCounts[fb.productName].count++;
      productCounts[fb.productName].totalRating += fb.rating;

      if (!regionalCounts[fb.regionName]) {
        regionalCounts[fb.regionName] = { count: 0, positive: 0, negative: 0, totalRating: 0 };
      }
      regionalCounts[fb.regionName].count++;
      regionalCounts[fb.regionName].totalRating += fb.rating;
      if (fb.sentiment === 'Positive') regionalCounts[fb.regionName].positive++;
      if (fb.sentiment === 'Negative') regionalCounts[fb.regionName].negative++;

      for (const pp of fb.painPoints || []) {
        painPointFreq[pp] = (painPointFreq[pp] || 0) + 1;
      }
      for (const feat of fb.requestedFeatures || []) {
        featureFreq[feat] = (featureFreq[feat] || 0) + 1;
      }
    }

    const analytics = {
      totalFeedback: total,
      avgRating: total > 0 ? Number((ratingSum / total).toFixed(2)) : 0,
      sentimentDistribution: [
        { name: 'Positive', count: sentimentCounts.Positive },
        { name: 'Neutral', count: sentimentCounts.Neutral },
        { name: 'Negative', count: sentimentCounts.Negative },
      ],
      categoryBreakdown: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
      productPreferences: Object.entries(productCounts).map(([product, stats]) => ({
        product,
        mentions: stats.count,
        avgRating: Number((stats.totalRating / stats.count).toFixed(2)),
      })),
      regionalBreakdown: Object.entries(regionalCounts).map(([region, stats]) => ({
        region,
        count: stats.count,
        avgRating: Number((stats.totalRating / stats.count).toFixed(2)),
        positivePct: Math.round((stats.positive / stats.count) * 100),
      })),
      priceSensitivity: Object.entries(priceSensitivityCounts).map(([level, count]) => ({ level, count })),
      topComplaints: Object.entries(painPointFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([complaint, count]) => ({ complaint, count })),
      topRequestedFeatures: Object.entries(featureFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([feature, count]) => ({ feature, count })),
    };

    res.json({
      customers: customerList,
      feedback: feedbackList,
      analytics,
    });
  } catch (error) {
    console.error('Customer intelligence fetch error:', error);
    res.status(500).json({ error: 'Failed to load customer intelligence data.' });
  }
});

customersRouter.post('/customers/feedback', requireAuth, requirePermission('customer:write'), async (req: AuthRequest, res) => {
  try {
    const {
      customerName,
      productName,
      regionName,
      industry,
      sourceType,
      feedbackText,
      rating,
    } = req.body as {
      customerName?: string;
      productName?: string;
      regionName?: string;
      industry?: string;
      sourceType?: string;
      feedbackText?: string;
      rating?: number;
    };

    if (!customerName?.trim() || !productName?.trim() || !feedbackText?.trim()) {
      res.status(400).json({ error: 'Customer name, product name, and feedback text are required.' });
      return;
    }

    const numericRating = Math.max(1, Math.min(5, Number(rating) || 3));
    const dedupHash = computeDedupHash(customerName, productName, feedbackText);

    const existing = await db
      .select({ id: customerFeedback.id })
      .from(customerFeedback)
      .where(inArray(customerFeedback.dedupHash, [dedupHash]))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'Duplicate feedback detected: an identical record already exists.' });
      return;
    }

    const [classified] = await analyzeFeedbackWithAI([
      { feedbackText: feedbackText.trim(), rating: numericRating },
    ]);

    const [inserted] = await db
      .insert(customerFeedback)
      .values({
        customerName: customerName.trim(),
        productName: productName.trim(),
        regionName: regionName?.trim() || 'Maharashtra',
        industry: industry?.trim() || 'Packaging',
        sourceType: sourceType?.trim() || 'Manual',
        feedbackText: feedbackText.trim(),
        rating: numericRating,
        sentiment: classified.sentiment,
        sentimentScore: classified.sentimentScore.toFixed(3),
        category: classified.category,
        painPoints: classified.painPoints,
        requestedFeatures: classified.requestedFeatures,
        priceSensitivity: classified.priceSensitivity,
        dedupHash,
        isSimulated: false,
        submittedBy: req.user?.id ?? null,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'CUSTOMER_FEEDBACK_ADDED',
      entityType: 'customer_feedback',
      entityId: inserted.id,
      details: { customerName: inserted.customerName, sentiment: inserted.sentiment },
    });

    res.status(201).json({ feedback: inserted });
  } catch (error) {
    console.error('Feedback submit error:', error);
    res.status(500).json({ error: 'Failed to save customer feedback.' });
  }
});

customersRouter.post(
  '/customers/import',
  requireAuth,
  requirePermission('customer:write'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please upload a CSV or Excel (.xlsx) file.' });
        return;
      }

      const ext = file.originalname.split('.').pop()?.toLowerCase();
      let rawRows: Record<string, unknown>[] = [];

      if (ext === 'csv') {
        rawRows = parseCsv(file.buffer.toString('utf-8'), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        res.status(400).json({ error: 'Only CSV and Excel (.xlsx) files are supported for feedback import.' });
        return;
      }

      if (rawRows.length === 0) {
        res.status(400).json({ error: 'Uploaded file contains no rows.' });
        return;
      }

      const normalizedRows = rawRows.map((row) => {
        const lowerMap: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          lowerMap[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = String(v ?? '').trim();
        }
        const customerName = lowerMap['customername'] || lowerMap['customer'] || lowerMap['company'] || '';
        const productName = lowerMap['productname'] || lowerMap['product'] || 'ProPrint A4 Copier';
        const regionName = lowerMap['regionname'] || lowerMap['region'] || lowerMap['state'] || 'Maharashtra';
        const industry = lowerMap['industry'] || 'Packaging';
        const feedbackText = lowerMap['feedbacktext'] || lowerMap['feedback'] || lowerMap['comment'] || lowerMap['comments'] || '';
        const rating = Math.max(1, Math.min(5, Number(lowerMap['rating'] || lowerMap['score']) || 3));
        return { customerName, productName, regionName, industry, feedbackText, rating };
      });

      const validRows = normalizedRows.filter((r) => r.customerName && r.feedbackText);
      const invalidCount = normalizedRows.length - validRows.length;

      if (validRows.length === 0) {
        res.status(400).json({
          error: 'No valid feedback rows found. Ensure columns include customerName (or customer) and feedbackText (or feedback).',
        });
        return;
      }

      // Deduplicate in-file & against DB
      const seenHashes = new Set<string>();
      const uniqueRows: Array<(typeof validRows)[number] & { dedupHash: string }> = [];
      let duplicateCount = 0;

      for (const r of validRows) {
        const hash = computeDedupHash(r.customerName, r.productName, r.feedbackText);
        if (seenHashes.has(hash)) {
          duplicateCount++;
          continue;
        }
        seenHashes.add(hash);
        uniqueRows.push({ ...r, dedupHash: hash });
      }

      const existingHashes = new Set(
        (
          await db
            .select({ dedupHash: customerFeedback.dedupHash })
            .from(customerFeedback)
            .where(inArray(customerFeedback.dedupHash, Array.from(seenHashes)))
        ).map((x) => x.dedupHash)
      );

      const newRows = uniqueRows.filter((r) => {
        if (existingHashes.has(r.dedupHash)) {
          duplicateCount++;
          return false;
        }
        return true;
      });

      if (newRows.length === 0) {
        res.json({
          importedCount: 0,
          duplicateCount,
          invalidCount,
          message: 'All valid rows already exist in the database (duplicates skipped).',
        });
        return;
      }

      const classifications = await analyzeFeedbackWithAI(
        newRows.slice(0, 40).map((r) => ({ feedbackText: r.feedbackText, rating: r.rating }))
      );

      const toInsert = newRows.map((r, idx) => {
        const cls = classifications[idx] || {
          sentiment: r.rating >= 4 ? 'Positive' : r.rating <= 2 ? 'Negative' : 'Neutral',
          sentimentScore: r.rating >= 4 ? 0.7 : r.rating <= 2 ? -0.5 : 0,
          category: 'Quality',
          painPoints: [],
          requestedFeatures: [],
          priceSensitivity: 'Medium',
        };
        return {
          customerName: r.customerName,
          productName: r.productName,
          regionName: r.regionName,
          industry: r.industry,
          sourceType: ext === 'csv' ? 'CSV' : 'Excel',
          feedbackText: r.feedbackText,
          rating: r.rating,
          sentiment: cls.sentiment,
          sentimentScore: cls.sentimentScore.toFixed(3),
          category: cls.category,
          painPoints: cls.painPoints,
          requestedFeatures: cls.requestedFeatures,
          priceSensitivity: cls.priceSensitivity,
          dedupHash: r.dedupHash,
          isSimulated: false,
          submittedBy: req.user?.id ?? null,
        };
      });

      await db.insert(customerFeedback).values(toInsert).onConflictDoNothing({ target: customerFeedback.dedupHash });

      await logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email || 'unknown',
        action: 'CUSTOMER_FEEDBACK_IMPORTED',
        entityType: 'customer_feedback',
        details: { fileName: file.originalname, importedCount: toInsert.length, duplicateCount, invalidCount },
      });

      res.status(201).json({
        importedCount: toInsert.length,
        duplicateCount,
        invalidCount,
        message: `Imported ${toInsert.length} feedback records (${duplicateCount} duplicates skipped, ${invalidCount} invalid rows skipped).`,
      });
    } catch (error) {
      console.error('Feedback import error:', error);
      res.status(500).json({ error: 'Failed to process feedback import file.' });
    }
  }
);

customersRouter.post('/customers/recommendations', requireAuth, requirePermission('customer:read'), async (_req, res) => {
  try {
    assertGeminiConfigured();
    const feedbackList = await db
      .select()
      .from(customerFeedback)
      .orderBy(desc(customerFeedback.createdAt))
      .limit(50);

    if (feedbackList.length === 0) {
      res.json({ recommendations: [], summary: 'No customer feedback records available yet.' });
      return;
    }

    const digest = feedbackList
      .map(
        (f) =>
          `- [${f.productName} | ${f.regionName} | ${f.industry} | ${f.sentiment} (${f.rating}/5) | ${f.category}]: "${f.feedbackText}"`
      )
      .join('\n');

    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Based strictly on these ${feedbackList.length} paper & packaging customer feedback records, generate a concise summary of key patterns and 4 actionable marketing/product recommendations.\n\nRECORDS:\n${digest}`,
      config: {
        systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  targetSegment: { type: Type.STRING },
                  action: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                },
                required: ['title', 'targetSegment', 'action', 'evidence'],
              },
            },
          },
          required: ['summary', 'recommendations'],
        },
      },
    });

    res.json(JSON.parse((resp.text || '{}').trim()));
  } catch (error: unknown) {
    console.error('Customer recommendations error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate recommendations.' });
  }
});

import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { campaignMetrics, campaigns, customerFeedback } from '../db/schema.ts';
import { createNotification, logAudit } from '../db/users.ts';
import { ai, assertGeminiConfigured, SYSTEM_SECURITY_GUARDRAIL, Type } from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';
import { retrieveRelevantChunks } from './knowledge.ts';

export const campaignsRouter = Router();

campaignsRouter.get('/campaigns', requireAuth, requirePermission('campaign:read'), async (_req, res) => {
  try {
    const [campaignList, metricsList] = await Promise.all([
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)),
      db.select().from(campaignMetrics).orderBy(campaignMetrics.metricDate),
    ]);
    res.json({ campaigns: campaignList, metrics: metricsList });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: 'Failed to load marketing campaigns.' });
  }
});

campaignsRouter.post('/campaigns/generate', requireAuth, requirePermission('campaign:write'), async (req: AuthRequest, res) => {
  try {
    assertGeminiConfigured();
    const {
      campaignType,
      productName,
      targetAudience,
      industry,
      region,
      objective,
      budgetInr,
      durationWeeks,
    } = req.body as {
      campaignType?: string;
      productName?: string;
      targetAudience?: string;
      industry?: string;
      region?: string;
      objective?: string;
      budgetInr?: number;
      durationWeeks?: number;
    };

    if (!productName?.trim() || !objective?.trim()) {
      res.status(400).json({ error: 'Product and marketing objective are required.' });
      return;
    }

    const budget = Math.max(50000, Number(budgetInr) || 1000000);
    const weeks = Math.max(2, Math.min(52, Number(durationWeeks) || 8));

    const [ragChunks, recentFeedback] = await Promise.all([
      retrieveRelevantChunks(`${productName} ${industry || ''} ${region || ''} ${campaignType || ''}`, 4),
      db.select().from(customerFeedback).orderBy(desc(customerFeedback.createdAt)).limit(6),
    ]);

    const ragContext = ragChunks
      .map((c) => `[${c.documentTitle}, p.${c.pageNumber}] ${c.content}`)
      .join('\n');
    const fbContext = recentFeedback
      .map((f) => `- ${f.productName} (${f.regionName}): "${f.feedbackText}"`)
      .join('\n');

    const prompt = `
Design an editable B2B marketing campaign draft for our paper & packaging product portfolio.
Parameters:
- Campaign Type: ${campaignType || 'B2B lead generation'}
- Product: ${productName}
- Target Audience: ${targetAudience || 'Industrial Packaging Converters & Distributors'}
- Industry: ${industry || 'Packaging'}
- Region: ${region || 'Maharashtra & Gujarat'}
- Objective: ${objective}
- Total Budget (INR): ${budget}
- Duration (Weeks): ${weeks}

Context from Knowledge Hub:
${ragContext || 'No matching uploaded documents.'}

Recent Customer Feedback Context:
${fbContext || 'No feedback records.'}

Generate a complete campaign blueprint with explicit assumptions. Ensure budgetAllocation amounts sum cleanly to ${budget} INR.
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
            campaignName: { type: Type.STRING },
            persona: { type: Type.STRING },
            valueProposition: { type: Type.STRING },
            keyMessage: { type: Type.STRING },
            channels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  channel: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  sharePercent: { type: Type.NUMBER },
                },
                required: ['channel', 'rationale', 'sharePercent'],
              },
            },
            budgetAllocation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  amountInr: { type: Type.NUMBER },
                  sharePercent: { type: Type.NUMBER },
                },
                required: ['item', 'amountInr', 'sharePercent'],
              },
            },
            calendar: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.STRING },
                  milestone: { type: Type.STRING },
                  deliverable: { type: Type.STRING },
                },
                required: ['week', 'milestone', 'deliverable'],
              },
            },
            kpis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  metric: { type: Type.STRING },
                  target: { type: Type.STRING },
                },
                required: ['metric', 'target'],
              },
            },
            expectedOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'campaignName',
            'persona',
            'valueProposition',
            'keyMessage',
            'channels',
            'budgetAllocation',
            'calendar',
            'kpis',
            'expectedOutcomes',
            'assumptions',
          ],
        },
      },
    });

    const plan = JSON.parse((resp.text || '{}').trim());

    const [saved] = await db
      .insert(campaigns)
      .values({
        name: plan.campaignName || `${productName} ${campaignType} Campaign`,
        campaignType: campaignType || 'B2B lead generation',
        productName: productName.trim(),
        targetAudience: targetAudience?.trim() || 'B2B Procurement & Converters',
        industry: industry?.trim() || 'Packaging',
        region: region?.trim() || 'All India',
        objective: objective.trim(),
        budgetInr: budget.toFixed(2),
        durationWeeks: weeks,
        status: 'draft', // Never auto-publish or auto-spend
        persona: plan.persona || '',
        valueProposition: plan.valueProposition || '',
        keyMessage: plan.keyMessage || '',
        channels: plan.channels || [],
        budgetAllocation: plan.budgetAllocation || [],
        calendar: plan.calendar || [],
        kpis: plan.kpis || [],
        expectedOutcomes: plan.expectedOutcomes || [],
        assumptions: plan.assumptions || [],
        createdBy: req.user?.id ?? null,
        isSimulated: false,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'CAMPAIGN_DRAFT_GENERATED',
      entityType: 'campaign',
      entityId: saved.id,
      details: { name: saved.name, budgetInr: budget },
    });

    res.status(201).json({ campaign: saved });
  } catch (error: unknown) {
    console.error('Campaign generation error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate campaign.' });
  }
});

campaignsRouter.patch('/campaigns/:id', requireAuth, requirePermission('campaign:write'), async (req: AuthRequest, res) => {
  try {
    const campaignId = String(req.params.id);
    const { name, keyMessage, valueProposition, objective, status } = req.body as {
      name?: string;
      keyMessage?: string;
      valueProposition?: string;
      objective?: string;
      status?: string;
    };

    const [existing] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    let approvedBy = existing.approvedBy;
    if (status && (status === 'approved' || status === 'active')) {
      const canApprove =
        req.user?.roleName === 'Administrator' ||
        req.user?.permissions.includes('campaign:approve');
      if (!canApprove) {
        res.status(403).json({
          error: `Only Marketing Head or Administrator can approve/activate campaigns (your role: ${req.user?.roleName}).`,
        });
        return;
      }
      approvedBy = req.user?.id ?? null;
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        name: name?.trim() ?? existing.name,
        keyMessage: keyMessage?.trim() ?? existing.keyMessage,
        valueProposition: valueProposition?.trim() ?? existing.valueProposition,
        objective: objective?.trim() ?? existing.objective,
        status: status ?? existing.status,
        approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: status ? `CAMPAIGN_STATUS_${status.toUpperCase()}` : 'CAMPAIGN_UPDATED',
      entityType: 'campaign',
      entityId: updated.id,
      details: { status: updated.status },
    });

    if (status === 'pending_approval') {
      await createNotification({
        userId: null,
        title: 'Campaign Awaiting Approval',
        message: `"${updated.name}" was submitted for leadership approval by ${req.user?.fullName}.`,
        type: 'warning',
        module: 'AI Campaign Studio',
      });
    } else if (status === 'approved' || status === 'active') {
      await createNotification({
        userId: existing.createdBy,
        title: `Campaign ${status === 'active' ? 'Activated' : 'Approved'}`,
        message: `"${updated.name}" has been ${status} by ${req.user?.fullName}.`,
        type: 'success',
        module: 'AI Campaign Studio',
      });
    }

    res.json({ campaign: updated });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: 'Failed to update campaign.' });
  }
});

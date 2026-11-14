import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { opportunities, productCategories, regions, systemSettings } from '../db/schema.ts';
import { logAudit } from '../db/users.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';

export interface OpportunityWeights {
  demandPotential: number;
  salesGrowth: number;
  customerDensity: number;
  distributionGap: number;
  competitiveOpportunity: number;
}

const DEFAULT_WEIGHTS: OpportunityWeights = {
  demandPotential: 30,
  salesGrowth: 20,
  customerDensity: 20,
  distributionGap: 15,
  competitiveOpportunity: 15,
};

async function getSavedWeights(): Promise<OpportunityWeights> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'opportunity_weights'))
    .limit(1);
  if (rows.length === 0) return DEFAULT_WEIGHTS;
  const val = rows[0].value as Partial<OpportunityWeights>;
  return {
    demandPotential: Number(val.demandPotential ?? 30),
    salesGrowth: Number(val.salesGrowth ?? 20),
    customerDensity: Number(val.customerDensity ?? 20),
    distributionGap: Number(val.distributionGap ?? 15),
    competitiveOpportunity: Number(val.competitiveOpportunity ?? 15),
  };
}

function computeScore(
  r: typeof regions.$inferSelect,
  w: OpportunityWeights
): {
  opportunityScore: number;
  demandScore: number;
  growthScore: number;
  densityScore: number;
  distributionGapScore: number;
  competitiveScore: number;
} {
  const demandScore = Number(r.demandPotentialScore);
  const growthScore = Number(r.salesGrowthScore);
  const densityScore = Number(r.customerDensityScore);
  const distributionGapScore = Number(r.distributionGapScore);
  const competitiveScore = Math.max(0, 100 - Number(r.competitorPresenceScore));

  const totalWeight =
    w.demandPotential +
    w.salesGrowth +
    w.customerDensity +
    w.distributionGap +
    w.competitiveOpportunity || 100;

  const opportunityScore = Number(
    (
      (demandScore * w.demandPotential +
        growthScore * w.salesGrowth +
        densityScore * w.customerDensity +
        distributionGapScore * w.distributionGap +
        competitiveScore * w.competitiveOpportunity) /
      totalWeight
    ).toFixed(2)
  );

  return {
    opportunityScore,
    demandScore,
    growthScore,
    densityScore,
    distributionGapScore,
    competitiveScore,
  };
}

export const regionalRouter = Router();

regionalRouter.get('/regional', requireAuth, requirePermission('regional:read'), async (_req, res) => {
  try {
    const [regionRows, weights, oppRows, salesByRegionResult, feedbackByRegionResult] = await Promise.all([
      db.select().from(regions).orderBy(regions.stateName),
      getSavedWeights(),
      db
        .select({
          id: opportunities.id,
          regionId: opportunities.regionId,
          title: opportunities.title,
          productCategoryName: opportunities.productCategoryName,
          opportunityScore: opportunities.opportunityScore,
          rationale: opportunities.rationale,
          recommendedNextSteps: opportunities.recommendedNextSteps,
          status: opportunities.status,
          isSimulated: opportunities.isSimulated,
        })
        .from(opportunities)
        .orderBy(desc(opportunities.opportunityScore)),
      db.execute(sql`
        SELECT
          region_id AS "regionId",
          ROUND(SUM(volume_mt)::numeric, 0)::float AS "totalVolumeMt",
          ROUND(SUM(revenue_inr_lakhs)::numeric, 0)::float AS "totalRevenueLakhs"
        FROM sales_records
        GROUP BY region_id
      `),
      db.execute(sql`
        SELECT
          region_name AS "regionName",
          COUNT(*)::int AS "feedbackCount"
        FROM customer_feedback
        GROUP BY region_name
      `),
    ]);

    const salesMap = new Map<string, { totalVolumeMt: number; totalRevenueLakhs: number }>();
    for (const row of (salesByRegionResult.rows || []) as Array<{
      regionId: string;
      totalVolumeMt: number;
      totalRevenueLakhs: number;
    }>) {
      salesMap.set(row.regionId, {
        totalVolumeMt: row.totalVolumeMt,
        totalRevenueLakhs: row.totalRevenueLakhs,
      });
    }

    const fbMap = new Map<string, number>();
    for (const row of (feedbackByRegionResult.rows || []) as Array<{
      regionName: string;
      feedbackCount: number;
    }>) {
      fbMap.set(row.regionName, row.feedbackCount);
    }

    const scoredRegions = regionRows
      .map((r) => {
        const scores = computeScore(r, weights);
        const sales = salesMap.get(r.id) || { totalVolumeMt: 0, totalRevenueLakhs: 0 };
        const feedbackCount = fbMap.get(r.stateName) || 0;
        const reasons: string[] = [];
        if (scores.demandScore >= 85) reasons.push(`High demand potential (${scores.demandScore}/100)`);
        if (scores.growthScore >= 80) reasons.push(`Strong sales growth (${scores.growthScore}/100)`);
        if (scores.distributionGapScore >= 65) reasons.push(`Underserved distribution gap (${scores.distributionGapScore}/100)`);
        if (scores.competitiveScore >= 40) reasons.push(`Moderate competitive intensity (${scores.competitiveScore}/100 headroom)`);
        if (reasons.length === 0) reasons.push('Balanced baseline commercial presence');

        return {
          ...r,
          ...scores,
          totalVolumeMt: sales.totalVolumeMt,
          totalRevenueLakhs: sales.totalRevenueLakhs,
          feedbackCount,
          rankingReasons: reasons,
          recommendedNextSteps: [
            scores.distributionGapScore >= 65
              ? `Appoint 2-3 authorized wholesale dealers in ${r.cityName}`
              : `Run key account retention & cross-sell programs across ${r.dealerCount} existing dealers`,
            `Prioritize packaging board & specialty trial reels for ${r.stateName} converters`,
          ],
        };
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    res.json({
      weights,
      regions: scoredRegions,
      opportunities: oppRows,
    });
  } catch (error) {
    console.error('Regional fetch error:', error);
    res.status(500).json({ error: 'Failed to load regional opportunity intelligence.' });
  }
});

regionalRouter.put(
  '/regional/weights',
  requireAuth,
  requirePermission('regional:configure'),
  async (req: AuthRequest, res) => {
    try {
      const weights = req.body as Partial<OpportunityWeights>;
      const normalized: OpportunityWeights = {
        demandPotential: Number(weights.demandPotential ?? 0),
        salesGrowth: Number(weights.salesGrowth ?? 0),
        customerDensity: Number(weights.customerDensity ?? 0),
        distributionGap: Number(weights.distributionGap ?? 0),
        competitiveOpportunity: Number(weights.competitiveOpportunity ?? 0),
      };

      const total =
        normalized.demandPotential +
        normalized.salesGrowth +
        normalized.customerDensity +
        normalized.distributionGap +
        normalized.competitiveOpportunity;

      if (Math.abs(total - 100) > 0.1) {
        res.status(400).json({ error: `Weights must sum to 100% (currently ${total}%).` });
        return;
      }

      await db
        .insert(systemSettings)
        .values({
          key: 'opportunity_weights',
          value: normalized as unknown as Record<string, unknown>,
          updatedBy: req.user?.email || 'admin',
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: normalized as unknown as Record<string, unknown>,
            updatedBy: req.user?.email || 'admin',
            updatedAt: new Date(),
          },
        });

      await logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email || 'unknown',
        action: 'REGIONAL_WEIGHTS_UPDATED',
        entityType: 'system_settings',
        details: normalized as unknown as Record<string, unknown>,
      });

      res.json({ weights: normalized });
    } catch (error) {
      console.error('Update weights error:', error);
      res.status(500).json({ error: 'Failed to update opportunity scoring weights.' });
    }
  }
);

regionalRouter.post('/regional/recalculate', requireAuth, requirePermission('regional:read'), async (req: AuthRequest, res) => {
  try {
    const { productCategoryName } = req.body as { productCategoryName?: string };
    const weights = await getSavedWeights();
    const regionRows = await db.select().from(regions);
    const categories = await db.select().from(productCategories);
    const chosenCat =
      categories.find((c) => c.name === productCategoryName) || categories[0];

    const newOpps = regionRows.map((r) => {
      const scores = computeScore(r, weights);
      return {
        regionId: r.id,
        productCategoryId: chosenCat?.id ?? null,
        productCategoryName: chosenCat?.name ?? 'Packaging Boards',
        title: `${r.stateName} — ${chosenCat?.name ?? 'Packaging Boards'} Growth Opportunity`,
        opportunityScore: scores.opportunityScore.toFixed(2),
        demandScore: scores.demandScore.toFixed(2),
        growthScore: scores.growthScore.toFixed(2),
        densityScore: scores.densityScore.toFixed(2),
        distributionGapScore: scores.distributionGapScore.toFixed(2),
        competitiveScore: scores.competitiveScore.toFixed(2),
        rationale: `Calculated score ${scores.opportunityScore}/100 based on Demand (${scores.demandScore}), Sales Growth (${scores.growthScore}), Density (${scores.densityScore}), Distribution Gap (${scores.distributionGapScore}), and Competitive Headroom (${scores.competitiveScore}).`,
        recommendedNextSteps: [
          `Target converters and institutional buyers in ${r.cityName}`,
          `Evaluate dealer coverage expansion beyond current ${r.dealerCount} active partners`,
        ],
        weightsSnapshot: weights as unknown as Record<string, number>,
        status: 'Identified',
        isSimulated: r.isSimulated,
      };
    });

    await db.delete(opportunities);
    const inserted = await db.insert(opportunities).values(newOpps).returning();

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'OPPORTUNITIES_RECALCULATED',
      entityType: 'opportunities',
      details: { count: inserted.length, category: chosenCat?.name },
    });

    res.json({ opportunities: inserted, weights });
  } catch (error) {
    console.error('Recalculate opportunities error:', error);
    res.status(500).json({ error: 'Failed to recalculate regional opportunities.' });
  }
});

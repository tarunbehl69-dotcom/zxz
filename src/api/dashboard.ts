import { Router } from 'express';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiInteractions,
  auditLogs,
  campaignMetrics,
  campaigns,
  competitors,
  customerFeedback,
  documents,
  opportunities,
  regions,
  reports,
  salesRecords,
} from '../db/schema.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', requireAuth, requirePermission('dashboard:read'), async (_req, res) => {
  try {
    const [
      [{ totalDocuments }],
      [{ totalFeedback }],
      [{ simulatedFeedback }],
      [{ totalCompetitors }],
      [{ totalOpportunities }],
      [{ activeCampaigns }],
      [{ totalReports }],
    ] = await Promise.all([
      db.select({ totalDocuments: count() }).from(documents),
      db.select({ totalFeedback: count() }).from(customerFeedback),
      db.select({ simulatedFeedback: count() }).from(customerFeedback).where(eq(customerFeedback.isSimulated, true)),
      db.select({ totalCompetitors: count() }).from(competitors),
      db.select({ totalOpportunities: count() }).from(opportunities),
      db.select({ activeCampaigns: count() }).from(campaigns).where(eq(campaigns.status, 'active')),
      db.select({ totalReports: count() }).from(reports),
    ]);

    // Monthly market demand / sales trend from sales_records
    const salesTrendResult = await db.execute(sql`
      SELECT
        period_month AS month,
        ROUND(SUM(volume_mt)::numeric, 0)::float AS "volumeMt",
        ROUND(SUM(revenue_inr_lakhs)::numeric, 0)::float AS "revenueLakhs",
        BOOL_AND(is_simulated) AS "isSimulated"
      FROM sales_records
      GROUP BY period_month
      ORDER BY period_month ASC
    `);

    // Product category mix
    const categoryMixResult = await db.execute(sql`
      SELECT
        product_category_name AS category,
        ROUND(SUM(volume_mt)::numeric, 0)::float AS "volumeMt",
        ROUND(SUM(revenue_inr_lakhs)::numeric, 0)::float AS "revenueLakhs"
      FROM sales_records
      GROUP BY product_category_name
      ORDER BY SUM(volume_mt) DESC
    `);

    // Customer sentiment distribution
    const sentimentResult = await db.execute(sql`
      SELECT
        sentiment,
        COUNT(*)::int AS count
      FROM customer_feedback
      GROUP BY sentiment
    `);

    // Top regional opportunities
    const topOpportunities = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        stateName: regions.stateName,
        cityName: regions.cityName,
        opportunityScore: opportunities.opportunityScore,
        productCategoryName: opportunities.productCategoryName,
        isSimulated: opportunities.isSimulated,
      })
      .from(opportunities)
      .innerJoin(regions, eq(opportunities.regionId, regions.id))
      .orderBy(desc(opportunities.opportunityScore))
      .limit(6);

    // Campaign performance
    const campaignPerfResult = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.status,
        c.is_simulated AS "isSimulated",
        COALESCE(SUM(cm.leads_generated), 0)::int AS leads,
        COALESCE(SUM(cm.conversions), 0)::int AS conversions,
        COALESCE(ROUND(AVG(cm.roi_percent)::numeric, 1), 0)::float AS "avgRoi"
      FROM campaigns c
      LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id
      GROUP BY c.id, c.name, c.status, c.is_simulated
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    // Recent AI recommendations
    const recentAi = await db
      .select({
        id: aiInteractions.id,
        module: aiInteractions.module,
        prompt: aiInteractions.prompt,
        response: aiInteractions.response,
        createdAt: aiInteractions.createdAt,
      })
      .from(aiInteractions)
      .orderBy(desc(aiInteractions.createdAt))
      .limit(4);

    // Recent activity
    const recentActivity = await db
      .select({
        id: auditLogs.id,
        userEmail: auditLogs.userEmail,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    res.json({
      kpis: {
        totalDocuments,
        totalFeedback,
        simulatedFeedback,
        totalCompetitors,
        totalOpportunities,
        activeCampaigns,
        totalReports,
      },
      salesTrend: salesTrendResult.rows || [],
      categoryMix: categoryMixResult.rows || [],
      sentimentDistribution: sentimentResult.rows || [],
      topOpportunities,
      campaignPerformance: campaignPerfResult.rows || [],
      recentAi,
      recentActivity,
    });
  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({ error: 'Failed to load executive dashboard metrics.' });
  }
});

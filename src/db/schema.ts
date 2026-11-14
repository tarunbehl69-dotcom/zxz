import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// 1. Roles
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Users (linked to Firebase Auth UID)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    avatarUrl: text('avatar_url'),
    roleId: uuid('role_id')
      .references(() => roles.id, { onDelete: 'restrict' })
      .notNull(),
    department: text('department').default('Marketing').notNull(),
    regionScope: text('region_scope').default('All India').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_id_idx').on(table.roleId),
  ]
);

// 3. Product Categories
export const productCategories = pgTable('product_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Products
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .references(() => productCategories.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    sku: text('sku').notNull().unique(),
    gsmRange: text('gsm_range').notNull(),
    brightness: text('brightness').notNull(),
    sustainabilityCert: text('sustainability_cert').default('FSC Mix').notNull(),
    applications: jsonb('applications').$type<string[]>().default([]).notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('products_category_idx').on(table.categoryId)]
);

// 5. Markets (Industry Segments)
export const markets = pgTable('markets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  industrySegment: text('industry_segment').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Regions (India States & Cities)
export const regions = pgTable(
  'regions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateName: text('state_name').notNull(),
    cityName: text('city_name').notNull(),
    zone: text('zone').notNull(), // North, West, South, East, Central
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    dealerCount: integer('dealer_count').default(0).notNull(),
    customerDensityScore: numeric('customer_density_score', { precision: 5, scale: 2 }).default('0').notNull(),
    competitorPresenceScore: numeric('competitor_presence_score', { precision: 5, scale: 2 }).default('0').notNull(),
    distributionGapScore: numeric('distribution_gap_score', { precision: 5, scale: 2 }).default('0').notNull(),
    demandPotentialScore: numeric('demand_potential_score', { precision: 5, scale: 2 }).default('0').notNull(),
    salesGrowthScore: numeric('sales_growth_score', { precision: 5, scale: 2 }).default('0').notNull(),
    isSimulated: boolean('is_simulated').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('regions_state_city_idx').on(table.stateName, table.cityName)]
);

// 7. Customers
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    companyName: text('company_name').notNull(),
    industry: text('industry').notNull(),
    segment: text('segment').notNull(), // Enterprise Converter, Distributor, Institutional Buyer, Publisher
    regionId: uuid('region_id').references(() => regions.id, { onDelete: 'set null' }),
    city: text('city').notNull(),
    state: text('state').notNull(),
    contactEmail: text('contact_email'),
    annualVolumeMt: numeric('annual_volume_mt', { precision: 10, scale: 2 }).default('0').notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('customers_industry_idx').on(table.industry),
    index('customers_region_idx').on(table.regionId),
  ]
);

// 8. Customer Feedback
export const customerFeedback = pgTable(
  'customer_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    regionId: uuid('region_id').references(() => regions.id, { onDelete: 'set null' }),
    regionName: text('region_name').notNull(),
    industry: text('industry').notNull(),
    sourceType: text('source_type').notNull(), // CSV, Excel, Manual, Survey
    feedbackText: text('feedback_text').notNull(),
    rating: integer('rating').notNull(),
    sentiment: text('sentiment').notNull(), // Positive, Neutral, Negative
    sentimentScore: numeric('sentiment_score', { precision: 4, scale: 3 }).notNull(),
    category: text('category').notNull(), // Quality, Pricing, Delivery, Packaging, Sustainability, Service
    painPoints: jsonb('pain_points').$type<string[]>().default([]).notNull(),
    requestedFeatures: jsonb('requested_features').$type<string[]>().default([]).notNull(),
    priceSensitivity: text('price_sensitivity').default('Medium').notNull(), // High, Medium, Low
    dedupHash: text('dedup_hash').notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('feedback_dedup_hash_idx').on(table.dedupHash),
    index('feedback_sentiment_idx').on(table.sentiment),
    index('feedback_industry_idx').on(table.industry),
  ]
);

// 9. Competitors
export const competitors = pgTable('competitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  headquarters: text('headquarters').notNull(),
  marketPositioning: text('market_positioning').notNull(),
  sustainabilityClaims: text('sustainability_claims').notNull(),
  strengths: jsonb('strengths').$type<string[]>().default([]).notNull(),
  weaknesses: jsonb('weaknesses').$type<string[]>().default([]).notNull(),
  website: text('website'),
  sourceName: text('source_name').notNull(),
  sourceDate: text('source_date').notNull(),
  verificationStatus: text('verification_status').default('Verified').notNull(), // Verified, Pending Review, Unverified
  isSimulated: boolean('is_simulated').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Competitor Products
export const competitorProducts = pgTable(
  'competitor_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    competitorId: uuid('competitor_id')
      .references(() => competitors.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
    categoryName: text('category_name').notNull(),
    productName: text('product_name').notNull(),
    gsmRange: text('gsm_range').notNull(),
    brightness: text('brightness').notNull(),
    pricePerMtInr: numeric('price_per_mt_inr', { precision: 10, scale: 2 }),
    specs: jsonb('specs').$type<Record<string, string>>().default({}).notNull(),
    sustainabilityCert: text('sustainability_cert').notNull(),
    sourceName: text('source_name').notNull(),
    sourceDate: text('source_date').notNull(),
    verificationStatus: text('verification_status').default('Verified').notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('competitor_products_comp_idx').on(table.competitorId)]
);

// 11. Documents (Knowledge Hub)
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(), // pdf, docx, xlsx, csv, txt
    fileSize: integer('file_size').notNull(),
    category: text('category').notNull(), // Market Research, Competitor Filing, Customer Survey, Internal Brief, Regulatory
    productCategory: text('product_category').default('All Categories').notNull(),
    region: text('region').default('All India').notNull(),
    industry: text('industry').default('All Industries').notNull(),
    status: text('status').default('processing').notNull(), // processing, indexed, failed
    errorMessage: text('error_message'),
    pageCount: integer('page_count').default(1).notNull(),
    chunkCount: integer('chunk_count').default(0).notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    rawSummary: text('raw_summary'),
    extractedFacts: jsonb('extracted_facts').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('documents_status_idx').on(table.status),
    index('documents_category_idx').on(table.category),
  ]
);

// 12. Document Chunks (with pgvector 768-d embeddings)
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    pageNumber: integer('page_number').default(1).notNull(),
    sectionTitle: text('section_title').default('General').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').default(0).notNull(),
    embedding: vector('embedding', { dimensions: 768 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('document_chunks_doc_idx').on(table.documentId)]
);

// 13. Sales Records
export const salesRecords = pgTable(
  'sales_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    regionId: uuid('region_id')
      .references(() => regions.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productCategoryName: text('product_category_name').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    periodMonth: text('period_month').notNull(), // YYYY-MM
    volumeMt: numeric('volume_mt', { precision: 12, scale: 2 }).notNull(),
    revenueInrLakhs: numeric('revenue_inr_lakhs', { precision: 12, scale: 2 }).notNull(),
    isSimulated: boolean('is_simulated').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('sales_region_idx').on(table.regionId),
    index('sales_period_idx').on(table.periodMonth),
  ]
);

// 14. Campaigns
export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    campaignType: text('campaign_type').notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    targetAudience: text('target_audience').notNull(),
    industry: text('industry').notNull(),
    region: text('region').notNull(),
    objective: text('objective').notNull(),
    budgetInr: numeric('budget_inr', { precision: 12, scale: 2 }).notNull(),
    durationWeeks: integer('duration_weeks').notNull(),
    status: text('status').default('draft').notNull(), // draft, pending_approval, approved, active, paused
    persona: text('persona').notNull(),
    valueProposition: text('value_proposition').notNull(),
    keyMessage: text('key_message').notNull(),
    channels: jsonb('channels').$type<{ channel: string; rationale: string; sharePercent: number }[]>().default([]).notNull(),
    budgetAllocation: jsonb('budget_allocation').$type<{ item: string; amountInr: number; sharePercent: number }[]>().default([]).notNull(),
    calendar: jsonb('calendar').$type<{ week: string; milestone: string; deliverable: string }[]>().default([]).notNull(),
    kpis: jsonb('kpis').$type<{ metric: string; target: string }[]>().default([]).notNull(),
    expectedOutcomes: jsonb('expected_outcomes').$type<string[]>().default([]).notNull(),
    assumptions: jsonb('assumptions').$type<string[]>().default([]).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('campaigns_status_idx').on(table.status)]
);

// 15. Campaign Metrics
export const campaignMetrics = pgTable(
  'campaign_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .references(() => campaigns.id, { onDelete: 'cascade' })
      .notNull(),
    metricDate: text('metric_date').notNull(), // YYYY-MM-DD
    impressions: integer('impressions').default(0).notNull(),
    leadsGenerated: integer('leads_generated').default(0).notNull(),
    dealerInquiries: integer('dealer_inquiries').default(0).notNull(),
    conversions: integer('conversions').default(0).notNull(),
    spendInr: numeric('spend_inr', { precision: 12, scale: 2 }).default('0').notNull(),
    roiPercent: numeric('roi_percent', { precision: 6, scale: 2 }).default('0').notNull(),
    isSimulated: boolean('is_simulated').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('campaign_metrics_camp_idx').on(table.campaignId)]
);

// 16. Opportunities
export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    regionId: uuid('region_id')
      .references(() => regions.id, { onDelete: 'cascade' })
      .notNull(),
    productCategoryId: uuid('product_category_id').references(() => productCategories.id, { onDelete: 'set null' }),
    productCategoryName: text('product_category_name').notNull(),
    title: text('title').notNull(),
    opportunityScore: numeric('opportunity_score', { precision: 5, scale: 2 }).notNull(),
    demandScore: numeric('demand_score', { precision: 5, scale: 2 }).notNull(),
    growthScore: numeric('growth_score', { precision: 5, scale: 2 }).notNull(),
    densityScore: numeric('density_score', { precision: 5, scale: 2 }).notNull(),
    distributionGapScore: numeric('distribution_gap_score', { precision: 5, scale: 2 }).notNull(),
    competitiveScore: numeric('competitive_score', { precision: 5, scale: 2 }).notNull(),
    rationale: text('rationale').notNull(),
    recommendedNextSteps: jsonb('recommended_next_steps').$type<string[]>().default([]).notNull(),
    weightsSnapshot: jsonb('weights_snapshot').$type<Record<string, number>>().default({}).notNull(),
    status: text('status').default('Identified').notNull(),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('opportunities_region_idx').on(table.regionId),
    index('opportunities_score_idx').on(table.opportunityScore),
  ]
);

// 17. Reports
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  executiveSummary: text('executive_summary').notNull(),
  objective: text('objective').notNull(),
  methodology: text('methodology').notNull(),
  dataSources: jsonb('data_sources').$type<string[]>().default([]).notNull(),
  analysis: text('analysis').notNull(),
  chartData: jsonb('chart_data').$type<{ label: string; value: number; unit?: string }[]>().default([]).notNull(),
  keyFindings: jsonb('key_findings').$type<string[]>().default([]).notNull(),
  recommendations: jsonb('recommendations').$type<string[]>().default([]).notNull(),
  assumptions: jsonb('assumptions').$type<string[]>().default([]).notNull(),
  limitations: jsonb('limitations').$type<string[]>().default([]).notNull(),
  generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. AI Interactions
export const aiInteractions = pgTable(
  'ai_interactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    module: text('module').notNull(), // assistant, market_intelligence, customer_intelligence, campaign_studio
    prompt: text('prompt').notNull(),
    response: text('response').notNull(),
    citations: jsonb('citations').$type<{ source: string; pageOrSection: string; excerpt: string }[]>().default([]).notNull(),
    assumptions: jsonb('assumptions').$type<string[]>().default([]).notNull(),
    reasoning: text('reasoning'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('ai_interactions_user_idx').on(table.userId)]
);

// 19. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    userEmail: text('user_email').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_user_idx').on(table.userId),
    index('audit_logs_created_idx').on(table.createdAt),
  ]
);

// 20. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').default('info').notNull(), // info, warning, success, alert
    module: text('module').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

// 21. System Settings (Opportunity scoring weights, governance policies)
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const competitorsRelations = relations(competitors, ({ many }) => ({
  products: many(competitorProducts),
}));

export const competitorProductsRelations = relations(competitorProducts, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorProducts.competitorId],
    references: [competitors.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  metrics: many(campaignMetrics),
}));

export const campaignMetricsRelations = relations(campaignMetrics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignMetrics.campaignId],
    references: [campaigns.id],
  }),
}));

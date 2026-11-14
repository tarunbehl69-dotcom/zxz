export type NavModuleId =
  | 'dashboard'
  | 'market'
  | 'customers'
  | 'competitors'
  | 'regional'
  | 'campaigns'
  | 'reports'
  | 'knowledge'
  | 'assistant'
  | 'notifications'
  | 'users'
  | 'settings';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  department: string;
  regionScope: string;
  isActive: boolean;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  productCategory: string;
  region: string;
  industry: string;
  status: 'processing' | 'indexed' | 'failed';
  errorMessage?: string | null;
  pageCount: number;
  chunkCount: number;
  rawSummary?: string | null;
  extractedFacts: string[];
  createdAt: string;
}

export interface CustomerFeedbackRecord {
  id: string;
  customerName: string;
  productName: string;
  regionName: string;
  industry: string;
  sourceType: string;
  feedbackText: string;
  rating: number;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  sentimentScore: string;
  category: string;
  painPoints: string[];
  requestedFeatures: string[];
  priceSensitivity: string;
  isSimulated: boolean;
  createdAt: string;
}

export interface CompetitorRecord {
  id: string;
  name: string;
  headquarters: string;
  marketPositioning: string;
  sustainabilityClaims: string;
  strengths: string[];
  weaknesses: string[];
  website?: string | null;
  sourceName: string;
  sourceDate: string;
  verificationStatus: string;
  isSimulated: boolean;
}

export interface CompetitorProductRecord {
  id: string;
  competitorId: string;
  categoryName: string;
  productName: string;
  gsmRange: string;
  brightness: string;
  pricePerMtInr?: string | null;
  sustainabilityCert: string;
  sourceName: string;
  sourceDate: string;
  verificationStatus: string;
  isSimulated: boolean;
}

export interface RegionScoredRecord {
  id: string;
  stateName: string;
  cityName: string;
  zone: string;
  latitude: string;
  longitude: string;
  dealerCount: number;
  customerDensityScore: string;
  competitorPresenceScore: string;
  distributionGapScore: string;
  demandPotentialScore: string;
  salesGrowthScore: string;
  opportunityScore: number;
  demandScore: number;
  growthScore: number;
  densityScore: number;
  competitiveScore: number;
  totalVolumeMt: number;
  totalRevenueLakhs: number;
  feedbackCount: number;
  rankingReasons: string[];
  recommendedNextSteps: string[];
  isSimulated: boolean;
}

export interface CampaignRecord {
  id: string;
  name: string;
  campaignType: string;
  productName: string;
  targetAudience: string;
  industry: string;
  region: string;
  objective: string;
  budgetInr: string;
  durationWeeks: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused';
  persona: string;
  valueProposition: string;
  keyMessage: string;
  channels: Array<{ channel: string; rationale: string; sharePercent: number }>;
  budgetAllocation: Array<{ item: string; amountInr: number; sharePercent: number }>;
  calendar: Array<{ week: string; milestone: string; deliverable: string }>;
  kpis: Array<{ metric: string; target: string }>;
  expectedOutcomes: string[];
  assumptions: string[];
  isSimulated: boolean;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  title: string;
  category: string;
  executiveSummary: string;
  objective: string;
  methodology: string;
  dataSources: string[];
  analysis: string;
  chartData: Array<{ label: string; value: number; unit?: string }>;
  keyFindings: string[];
  recommendations: string[];
  assumptions: string[];
  limitations: string[];
  createdAt: string;
}

export interface AiInteractionRecord {
  id: string;
  module: string;
  prompt: string;
  response: string;
  citations: Array<{ source: string; pageOrSection: string; excerpt: string }>;
  assumptions: string[];
  reasoning?: string | null;
  createdAt: string;
}

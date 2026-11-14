import crypto from 'node:crypto';
import { count, eq, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  aiInteractions,
  campaignMetrics,
  campaigns,
  competitorProducts,
  competitors,
  customerFeedback,
  customers,
  documentChunks,
  documents,
  markets,
  notifications,
  opportunities,
  productCategories,
  products,
  regions,
  reports,
  salesRecords,
  systemSettings,
} from './schema.ts';
import { generateEmbedding } from '../lib/gemini.ts';
import { ensureRolesExist } from './users.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureBaselineDataSeeded(force = false): Promise<void> {
  if (force) {
    seedPromise = null;
  }
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    console.error('Baseline seed warning:', err);
  });
  return seedPromise;
}

async function runSeed() {
  await ensureRolesExist();

  // 1. System Settings
  await db
    .insert(systemSettings)
    .values([
      {
        key: 'opportunity_weights',
        value: {
          demandPotential: 30,
          salesGrowth: 20,
          customerDensity: 20,
          distributionGap: 15,
          competitiveOpportunity: 15,
        },
        updatedBy: 'system',
      },
      {
        key: 'industry_categories',
        value: {
          items: [
            'Printing',
            'Publishing',
            'Education',
            'FMCG',
            'Pharmaceuticals',
            'Food & Beverage',
            'Packaging',
          ],
        },
        updatedBy: 'system',
      },
    ])
    .onConflictDoNothing({ target: systemSettings.key });

  // 2. Product Categories
  const categorySpecs = [
    {
      name: 'Writing & Printing Paper',
      code: 'WPP',
      description: 'Uncoated woodfree maplitho, creamwove, and high-brightness publishing grades.',
    },
    {
      name: 'Office & Copier Paper',
      code: 'OCP',
      description: 'Multi-purpose A4/A3 high-speed copier papers engineered for jam-free printing.',
    },
    {
      name: 'Coated Paper',
      code: 'CP',
      description: 'Art paper and art board for high-definition commercial catalogues and magazines.',
    },
    {
      name: 'Packaging Boards',
      code: 'PKB',
      description: 'Virgin fiber folding box board (FBB), SBS, and high-stiffness boards for FMCG and pharma.',
    },
    {
      name: 'Specialty Paper',
      code: 'SPP',
      description: 'Cupstock, thermal, aqueous barrier-coated food-grade, and security papers.',
    },
  ];

  for (const cat of categorySpecs) {
    await db.insert(productCategories).values(cat).onConflictDoNothing({ target: productCategories.code });
  }
  const allCategories = await db.select().from(productCategories);
  const catMap = Object.fromEntries(allCategories.map((c) => [c.code, c.id]));

  // 3. Portfolio Flagship Products
  const productSpecs = [
    {
      categoryId: catMap['OCP'],
      name: 'ProPrint A4 Copier',
      sku: 'PP-COP-75',
      gsmRange: '70 - 80 GSM',
      brightness: '92% ISO',
      sustainabilityCert: 'FSC Mix · ECF Pulp',
      applications: ['Enterprise Printing', 'Government Tenders', 'Copy Centers'],
      description: 'Multi-purpose office paper with ColorLok rapid-drying surface technology.',
    },
    {
      categoryId: catMap['OCP'],
      name: 'ValuePrint Copier 70',
      sku: 'PP-EZC-70',
      gsmRange: '70 GSM',
      brightness: '90% ISO',
      sustainabilityCert: 'FSC Mix · Social Farm Forestry',
      applications: ['High-Volume Photocopying', 'Coaching Institutes', 'Back-Office Printing'],
      description: 'Value-engineered everyday office copier paper for double-sided printing.',
    },
    {
      categoryId: catMap['OCP'],
      name: 'ExecBright Laser 100',
      sku: 'PP-CED-100',
      gsmRange: '90 - 100 GSM',
      brightness: '96% ISO',
      sustainabilityCert: 'FSC Certified',
      applications: ['Corporate Presentations', 'Legal Documentation', 'Color Laser Printing'],
      description: 'Super-bright premium executive office paper for high-impact business documents.',
    },
    {
      categoryId: catMap['WPP'],
      name: 'UltraOpaque Maplitho',
      sku: 'PP-FIN-80',
      gsmRange: '60 - 120 GSM',
      brightness: '90% ISO',
      sustainabilityCert: 'FSC Mix',
      applications: ['Textbooks', 'Commercial Publishing', 'Notebooks'],
      description: 'High-opacity uncoated woodfree paper optimized for high-speed web offset.',
    },
    {
      categoryId: catMap['WPP'],
      name: 'HiWhite Offset 80',
      sku: 'PP-SPK-75',
      gsmRange: '70 - 90 GSM',
      brightness: '93% ISO',
      sustainabilityCert: 'FSC Mix · ECF Pulp',
      applications: ['Annual Reports', 'Educational Workbooks', 'Diary Printing'],
      description: 'High-whiteness surface-sized maplitho grade for crisp four-color offset.',
    },
    {
      categoryId: catMap['PKB'],
      name: 'StiffCore Virgin FBB',
      sku: 'PP-TUF-300',
      gsmRange: '230 - 400 GSM',
      brightness: '84% ISO',
      sustainabilityCert: '100% Virgin Fiber · Food Safe',
      applications: ['Pharmaceutical Cartons', 'FMCG Folding Boxes', 'Personal Care'],
      description: 'High-stiffness virgin folding box board engineered for high-speed die-cutting and embossing.',
    },
    {
      categoryId: catMap['PKB'],
      name: 'UltraSmooth SBS Board',
      sku: 'PP-ULT-280',
      gsmRange: '220 - 350 GSM',
      brightness: '89% ISO',
      sustainabilityCert: 'FSC Certified · USFDA Food Contact',
      applications: ['Luxury Cosmetics', 'Confectionery', 'Healthcare'],
      description: 'Solid bleached sulfate board with superior double-blade coating smoothness.',
    },
    {
      categoryId: catMap['SPP'],
      name: 'AquaShield Barrier Cupstock',
      sku: 'PP-ECO-210',
      gsmRange: '170 - 260 GSM',
      brightness: '83% ISO',
      sustainabilityCert: 'PFAS-Free Barrier · Recyclable',
      applications: ['QSR Beverage Cups', 'Takeaway Food Containers', 'Ice Cream Tubs'],
      description: 'Plastic-free aqueous barrier coated base paper replacing traditional LDPE-lined board.',
    },
    {
      categoryId: catMap['CP'],
      name: 'GlossPro Coated Art',
      sku: 'PP-ART-130',
      gsmRange: '90 - 170 GSM',
      brightness: '94% ISO',
      sustainabilityCert: 'FSC Mix',
      applications: ['Product Catalogues', 'Magazines', 'Brochures'],
      description: 'Gloss and matte double-coated art paper for crisp halftone reproduction.',
    },
  ];

  for (const prod of productSpecs) {
    await db.insert(products).values(prod).onConflictDoNothing({ target: products.sku });
  }
  const allProducts = await db.select().from(products);
  const prodMap = Object.fromEntries(allProducts.map((p) => [p.name, p.id]));

  // 4. Markets
  const marketSpecs = [
    { name: 'Printing & Commercial Print', industrySegment: 'Printing', description: 'Offset, digital, and commercial print houses across metro and Tier-2 clusters.' },
    { name: 'Textbook & Trade Publishing', industrySegment: 'Publishing', description: 'K-12 textbook publishers, academic presses, and notebook converters.' },
    { name: 'Higher Ed & Institutional Stationery', industrySegment: 'Education', description: 'Universities, coaching institutes, and state textbook boards.' },
    { name: 'FMCG Folding Cartons', industrySegment: 'FMCG', description: 'Home care, personal care, and packaged consumer goods secondary cartons.' },
    { name: 'Pharmaceutical Blister & Carton', industrySegment: 'Pharmaceuticals', description: 'GMP-compliant blister backing and serialized mono-cartons.' },
    { name: 'QSR & Food Service Packaging', industrySegment: 'Food & Beverage', description: 'Single-use plastic replacement food trays, cups, and greaseproof wraps.' },
    { name: 'E-Commerce & Corrugated Packaging', industrySegment: 'Packaging', description: 'Rigid boxes, kraft mailers, and sustainable protective packaging.' },
  ];
  for (const m of marketSpecs) {
    await db.insert(markets).values(m).onConflictDoNothing({ target: markets.name });
  }

  // 5. India Regions (12 major hubs)
  const regionSpecs = [
    {
      stateName: 'Maharashtra',
      cityName: 'Mumbai & Pune Corridor',
      zone: 'West',
      latitude: '19.076000',
      longitude: '72.877700',
      dealerCount: 48,
      customerDensityScore: '89.00',
      competitorPresenceScore: '78.00',
      distributionGapScore: '42.00',
      demandPotentialScore: '92.00',
      salesGrowthScore: '81.00',
      isSimulated: true,
    },
    {
      stateName: 'Gujarat',
      cityName: 'Ahmedabad & Vapi',
      zone: 'West',
      latitude: '23.022500',
      longitude: '72.571400',
      dealerCount: 34,
      customerDensityScore: '85.00',
      competitorPresenceScore: '62.00',
      distributionGapScore: '68.00',
      demandPotentialScore: '90.00',
      salesGrowthScore: '86.00',
      isSimulated: true,
    },
    {
      stateName: 'Delhi NCR',
      cityName: 'New Delhi & Noida',
      zone: 'North',
      latitude: '28.613900',
      longitude: '77.209000',
      dealerCount: 52,
      customerDensityScore: '91.00',
      competitorPresenceScore: '84.00',
      distributionGapScore: '38.00',
      demandPotentialScore: '88.00',
      salesGrowthScore: '74.00',
      isSimulated: true,
    },
    {
      stateName: 'Telangana',
      cityName: 'Hyderabad Pharma Hub',
      zone: 'South',
      latitude: '17.385000',
      longitude: '78.486700',
      dealerCount: 22,
      customerDensityScore: '82.00',
      competitorPresenceScore: '54.00',
      distributionGapScore: '76.00',
      demandPotentialScore: '91.00',
      salesGrowthScore: '88.00',
      isSimulated: true,
    },
    {
      stateName: 'Karnataka',
      cityName: 'Bengaluru',
      zone: 'South',
      latitude: '12.971600',
      longitude: '77.594600',
      dealerCount: 31,
      customerDensityScore: '84.00',
      competitorPresenceScore: '65.00',
      distributionGapScore: '61.00',
      demandPotentialScore: '86.00',
      salesGrowthScore: '83.00',
      isSimulated: true,
    },
    {
      stateName: 'Tamil Nadu',
      cityName: 'Chennai & Sivakasi',
      zone: 'South',
      latitude: '13.082700',
      longitude: '80.270700',
      dealerCount: 39,
      customerDensityScore: '88.00',
      competitorPresenceScore: '79.00',
      distributionGapScore: '51.00',
      demandPotentialScore: '85.00',
      salesGrowthScore: '77.00',
      isSimulated: true,
    },
    {
      stateName: 'West Bengal',
      cityName: 'Kolkata',
      zone: 'East',
      latitude: '22.572600',
      longitude: '88.363900',
      dealerCount: 26,
      customerDensityScore: '74.00',
      competitorPresenceScore: '58.00',
      distributionGapScore: '64.00',
      demandPotentialScore: '76.00',
      salesGrowthScore: '71.00',
      isSimulated: true,
    },
    {
      stateName: 'Madhya Pradesh',
      cityName: 'Indore & Bhopal',
      zone: 'Central',
      latitude: '22.719600',
      longitude: '75.857700',
      dealerCount: 16,
      customerDensityScore: '66.00',
      competitorPresenceScore: '41.00',
      distributionGapScore: '82.00',
      demandPotentialScore: '79.00',
      salesGrowthScore: '84.00',
      isSimulated: true,
    },
    {
      stateName: 'Himachal Pradesh',
      cityName: 'Baddi Pharma Belt',
      zone: 'North',
      latitude: '30.957800',
      longitude: '76.791400',
      dealerCount: 12,
      customerDensityScore: '79.00',
      competitorPresenceScore: '48.00',
      distributionGapScore: '84.00',
      demandPotentialScore: '89.00',
      salesGrowthScore: '87.00',
      isSimulated: true,
    },
    {
      stateName: 'Rajasthan',
      cityName: 'Jaipur & Kota',
      zone: 'North',
      latitude: '26.912400',
      longitude: '75.787300',
      dealerCount: 19,
      customerDensityScore: '73.00',
      competitorPresenceScore: '52.00',
      distributionGapScore: '71.00',
      demandPotentialScore: '80.00',
      salesGrowthScore: '78.00',
      isSimulated: true,
    },
    {
      stateName: 'Uttar Pradesh',
      cityName: 'Lucknow & Kanpur',
      zone: 'North',
      latitude: '26.846700',
      longitude: '80.946200',
      dealerCount: 24,
      customerDensityScore: '78.00',
      competitorPresenceScore: '61.00',
      distributionGapScore: '74.00',
      demandPotentialScore: '83.00',
      salesGrowthScore: '80.00',
      isSimulated: true,
    },
    {
      stateName: 'Odisha',
      cityName: 'Bhubaneswar & Cuttack',
      zone: 'East',
      latitude: '20.296100',
      longitude: '85.824500',
      dealerCount: 15,
      customerDensityScore: '64.00',
      competitorPresenceScore: '36.00',
      distributionGapScore: '69.00',
      demandPotentialScore: '74.00',
      salesGrowthScore: '76.00',
      isSimulated: true,
    },
  ];

  for (const r of regionSpecs) {
    await db
      .insert(regions)
      .values(r)
      .onConflictDoNothing({ target: [regions.stateName, regions.cityName] });
  }
  const allRegions = await db.select().from(regions);
  const regMap = Object.fromEntries(allRegions.map((r) => [r.stateName, r]));

  // 6. Customers (ensure 12 authentic accounts)
  const [{ total: custCount }] = await db.select({ total: count() }).from(customers);
  if (custCount < 10) {
    const existingCustNames = new Set((await db.select({ companyName: customers.companyName }).from(customers)).map((c) => c.companyName));
    const customerSeed = [
      { name: 'Rajesh Kulkarni', companyName: 'Sahyadri Packaging Solutions Pvt Ltd', industry: 'Pharmaceuticals', segment: 'Enterprise Converter', regionId: regMap['Telangana']?.id, city: 'Hyderabad', state: 'Telangana', contactEmail: 'procurement@sahyadripack.example.in', annualVolumeMt: '4200.00', isSimulated: true },
      { name: 'Meera Deshmukh', companyName: 'Navneet & Western Print Works', industry: 'Publishing', segment: 'Publisher', regionId: regMap['Maharashtra']?.id, city: 'Pune', state: 'Maharashtra', contactEmail: 'sourcing@westernprint.example.in', annualVolumeMt: '6800.00', isSimulated: true },
      { name: 'Anand Patel', companyName: 'Vapi EcoCarton Converters', industry: 'FMCG', segment: 'Enterprise Converter', regionId: regMap['Gujarat']?.id, city: 'Vapi', state: 'Gujarat', contactEmail: 'anand@vapiecocarton.example.in', annualVolumeMt: '5100.00', isSimulated: true },
      { name: 'Vikram Malhotra', companyName: 'Capital Office Supplies & Distributors', industry: 'Education', segment: 'Distributor', regionId: regMap['Delhi NCR']?.id, city: 'Noida', state: 'Delhi NCR', contactEmail: 'vikram@capitaloffice.example.in', annualVolumeMt: '3400.00', isSimulated: true },
      { name: 'Karthik Subramanian', companyName: 'Southern QSR Disposables', industry: 'Food & Beverage', segment: 'Enterprise Converter', regionId: regMap['Karnataka']?.id, city: 'Bengaluru', state: 'Karnataka', contactEmail: 'karthik@southernqsr.example.in', annualVolumeMt: '2150.00', isSimulated: true },
      { name: 'Ritu Sharma', companyName: 'Shivalik Medipack Industries', industry: 'Pharmaceuticals', segment: 'Enterprise Converter', regionId: regMap['Himachal Pradesh']?.id, city: 'Baddi', state: 'Himachal Pradesh', contactEmail: 'ritu@shivalikmedipack.example.in', annualVolumeMt: '3850.00', isSimulated: true },
      { name: 'Senthil Kumar', companyName: 'Sivakasi Fine Offset Printers', industry: 'Printing', segment: 'Institutional Buyer', regionId: regMap['Tamil Nadu']?.id, city: 'Sivakasi', state: 'Tamil Nadu', contactEmail: 'senthil@sivakasioffset.example.in', annualVolumeMt: '2900.00', isSimulated: true },
      { name: 'Debashis Roy', companyName: 'Hooghly Academic Press', industry: 'Publishing', segment: 'Publisher', regionId: regMap['West Bengal']?.id, city: 'Kolkata', state: 'West Bengal', contactEmail: 'debashis@hooghlypress.example.in', annualVolumeMt: '3100.00', isSimulated: true },
      { name: 'Prakash Agarwal', companyName: 'Malwa Paper Mart & Stationers', industry: 'Education', segment: 'Distributor', regionId: regMap['Madhya Pradesh']?.id, city: 'Indore', state: 'Madhya Pradesh', contactEmail: 'prakash@malwapaper.example.in', annualVolumeMt: '1950.00', isSimulated: true },
      { name: 'Neha Bansal', companyName: 'PinkCity Coaching Stationery Co', industry: 'Education', segment: 'Institutional Buyer', regionId: regMap['Rajasthan']?.id, city: 'Kota', state: 'Rajasthan', contactEmail: 'neha@pinkcitystationery.example.in', annualVolumeMt: '2600.00', isSimulated: true },
      { name: 'Arvind Tiwari', companyName: 'Awadh Commercial Printers', industry: 'Printing', segment: 'Enterprise Converter', regionId: regMap['Uttar Pradesh']?.id, city: 'Lucknow', state: 'Uttar Pradesh', contactEmail: 'arvind@awadhprinters.example.in', annualVolumeMt: '2300.00', isSimulated: true },
      { name: 'Sanjay Mohanty', companyName: 'Kalinga GreenPack Pvt Ltd', industry: 'Packaging', segment: 'Enterprise Converter', regionId: regMap['Odisha']?.id, city: 'Cuttack', state: 'Odisha', contactEmail: 'sanjay@kalingagreen.example.in', annualVolumeMt: '1750.00', isSimulated: true },
    ];
    const missing = customerSeed.filter((c) => !existingCustNames.has(c.companyName));
    if (missing.length > 0) await db.insert(customers).values(missing);
  }

  // 7. Customer Feedback (14 rich B2B records with SHA-256 dedup)
  const feedbackSeed = [
    { customerName: 'Sahyadri Packaging Solutions Pvt Ltd', productName: 'StiffCore Virgin FBB', regionName: 'Telangana', industry: 'Pharmaceuticals', sourceType: 'Survey', feedbackText: 'Stiffness and creasing performance on Bobst die-cutters are consistently strong, though lead times during Q4 peak pharma dispatch stretched by 5 days.', rating: 4, sentiment: 'Positive', sentimentScore: '0.780', category: 'Delivery', painPoints: ['Peak season dispatch lead time (+5 days)'], requestedFeatures: ['Guaranteed 72-hour Hyderabad depot buffer stock'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Navneet & Western Print Works', productName: 'UltraOpaque Maplitho', regionName: 'Maharashtra', industry: 'Publishing', sourceType: 'Survey', feedbackText: 'Opacity and web-offset runnability remain superior to spot-market mills. Reel tension consistency helps us minimize paper breaks.', rating: 5, sentiment: 'Positive', sentimentScore: '0.920', category: 'Quality', painPoints: [], requestedFeatures: ['62 GSM high-bulk variant for competitive K-12 bids'], priceSensitivity: 'High', isSimulated: true },
    { customerName: 'Vapi EcoCarton Converters', productName: 'UltraSmooth SBS Board', regionName: 'Gujarat', industry: 'FMCG', sourceType: 'Manual', feedbackText: 'Print gloss is excellent for personal care cartons, but pricing sits 4% above competing imported FBB reels when spot rates drop.', rating: 3, sentiment: 'Neutral', sentimentScore: '0.050', category: 'Pricing', painPoints: ['4% price gap vs spot imported boards'], requestedFeatures: ['Quarterly volume rebate slab for >400 MT/month'], priceSensitivity: 'High', isSimulated: true },
    { customerName: 'Capital Office Supplies & Distributors', productName: 'ProPrint A4 Copier', regionName: 'Delhi NCR', industry: 'Education', sourceType: 'Survey', feedbackText: 'Ream moisture protection is good, however outer 5-ream carton boxes occasionally crush during monsoon warehouse stacking.', rating: 3, sentiment: 'Negative', sentimentScore: '-0.420', category: 'Packaging', painPoints: ['Outer corrugated shipper box crushing in monsoon humidity'], requestedFeatures: ['Higher ECT outer master carton for 5-ream packs'], priceSensitivity: 'Low', isSimulated: true },
    { customerName: 'Southern QSR Disposables', productName: 'AquaShield Barrier Cupstock', regionName: 'Karnataka', industry: 'Food & Beverage', sourceType: 'Survey', feedbackText: 'PFAS-free aqueous coating seals reliably at standard cup-forming speeds and helps our QSR clients meet state single-use plastic bans.', rating: 5, sentiment: 'Positive', sentimentScore: '0.890', category: 'Sustainability', painPoints: [], requestedFeatures: ['Oil & grease resistant 240 GSM tray grade'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Shivalik Medipack Industries', productName: 'StiffCore Virgin FBB', regionName: 'Himachal Pradesh', industry: 'Pharmaceuticals', sourceType: 'Survey', feedbackText: '2D QR serialization ink dries cleanly on the coated surface, but Baddi converters need smaller 3-ton custom sheet size MOQs.', rating: 4, sentiment: 'Positive', sentimentScore: '0.640', category: 'Service', painPoints: ['High minimum order quantity for custom sheet sizes'], requestedFeatures: ['3-ton custom sheet MOQ from North hub'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Sivakasi Fine Offset Printers', productName: 'GlossPro Coated Art', regionName: 'Tamil Nadu', industry: 'Printing', sourceType: 'Survey', feedbackText: 'Halftone dot sharpness on 130 GSM gloss is reliable; however two recent pallets had minor edge-wave from humid transit.', rating: 3, sentiment: 'Negative', sentimentScore: '-0.380', category: 'Quality', painPoints: ['Pallet edge-wave in coastal transit humidity'], requestedFeatures: ['Stretch-hood moisture wrap for South coastal routes'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Hooghly Academic Press', productName: 'HiWhite Offset 80', regionName: 'West Bengal', industry: 'Publishing', sourceType: 'Survey', feedbackText: 'High brightness and smooth bulk give our textbook series premium feel with very low blanket piling during 40k-impression runs.', rating: 5, sentiment: 'Positive', sentimentScore: '0.910', category: 'Quality', painPoints: [], requestedFeatures: ['Pre-cut folio sheets with faster Kolkata depot dispatch'], priceSensitivity: 'High', isSimulated: true },
    { customerName: 'Malwa Paper Mart & Stationers', productName: 'ValuePrint Copier 70', regionName: 'Madhya Pradesh', industry: 'Education', sourceType: 'Manual', feedbackText: 'Strong brand pull in Indore coaching centers, though competitors offer an extra 15-day credit window during exam season.', rating: 3, sentiment: 'Neutral', sentimentScore: '0.120', category: 'Pricing', painPoints: ['Shorter dealer credit terms vs regional mills'], requestedFeatures: ['Seasonal 45-day dealer credit scheme in Feb-May'], priceSensitivity: 'High', isSimulated: true },
    { customerName: 'PinkCity Coaching Stationery Co', productName: 'ProPrint A4 Copier', regionName: 'Rajasthan', industry: 'Education', sourceType: 'Survey', feedbackText: 'Zero jam rate on high-speed Xerox and Canon production printers. ColorLok ink sharpness makes ProPrint A4 Copier our preferred SKU.', rating: 5, sentiment: 'Positive', sentimentScore: '0.940', category: 'Quality', painPoints: [], requestedFeatures: ['Bulk 2500-sheet institutional eco-box pack'], priceSensitivity: 'Low', isSimulated: true },
    { customerName: 'Awadh Commercial Printers', productName: 'ExecBright Laser 100', regionName: 'Uttar Pradesh', industry: 'Printing', sourceType: 'Survey', feedbackText: '96% ISO brightness stands out for government tender proposals, though dealer availability of 100 GSM A3 packets is inconsistent.', rating: 4, sentiment: 'Positive', sentimentScore: '0.710', category: 'Delivery', painPoints: ['Inconsistent A3 100 GSM stock at Tier-2 UP dealers'], requestedFeatures: ['Dedicated Lucknow A3 stocking mandate'], priceSensitivity: 'Low', isSimulated: true },
    { customerName: 'Kalinga GreenPack Pvt Ltd', productName: 'AquaShield Barrier Cupstock', regionName: 'Odisha', industry: 'Packaging', sourceType: 'Survey', feedbackText: 'Proximity to our Eastern mill hub keeps freight predictable and FSC Mix documentation simplifies audits for national FMCG food brands.', rating: 5, sentiment: 'Positive', sentimentScore: '0.880', category: 'Sustainability', painPoints: [], requestedFeatures: ['Pre-printed FSC QR badge artwork guidelines'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Vapi EcoCarton Converters', productName: 'StiffCore Virgin FBB', regionName: 'Gujarat', industry: 'FMCG', sourceType: 'Manual', feedbackText: 'Western mill deliveries arrive within 48 hours and ply-bond strength holds well in high-speed folder-gluers.', rating: 5, sentiment: 'Positive', sentimentScore: '0.860', category: 'Delivery', painPoints: [], requestedFeatures: ['Automated digital ASN dispatch alerts'], priceSensitivity: 'Medium', isSimulated: true },
    { customerName: 'Capital Office Supplies & Distributors', productName: 'ValuePrint Copier 70', regionName: 'Delhi NCR', industry: 'Education', sourceType: 'Survey', feedbackText: 'Price positioning against imported Indonesian A4 reams gets tight whenever container freight softens.', rating: 2, sentiment: 'Negative', sentimentScore: '-0.510', category: 'Pricing', painPoints: ['Price pressure from imported A4 copier reams'], requestedFeatures: ['Tiered volume rebate for institutional tenders'], priceSensitivity: 'High', isSimulated: true },
  ];

  for (const fb of feedbackSeed) {
    const hash = crypto
      .createHash('sha256')
      .update(`${fb.customerName.trim().toLowerCase()}|${fb.productName.trim().toLowerCase()}|${fb.feedbackText.trim().toLowerCase().replace(/\s+/g, ' ')}`)
      .digest('hex');
    await db
      .insert(customerFeedback)
      .values({
        customerName: fb.customerName,
        productId: prodMap[fb.productName] ?? null,
        productName: fb.productName,
        regionId: regMap[fb.regionName]?.id ?? null,
        regionName: fb.regionName,
        industry: fb.industry,
        sourceType: fb.sourceType,
        feedbackText: fb.feedbackText,
        rating: fb.rating,
        sentiment: fb.sentiment,
        sentimentScore: fb.sentimentScore,
        category: fb.category,
        painPoints: fb.painPoints,
        requestedFeatures: fb.requestedFeatures,
        priceSensitivity: fb.priceSensitivity,
        dedupHash: hash,
        isSimulated: true,
      })
      .onConflictDoNothing({ target: customerFeedback.dedupHash });
  }

  // 8. Competitors & Competitor Products (6 authentic Indian paper/packaging peers)
  const compSpecs = [
    {
      name: 'ITC PSPD (Paperboards & Specialty Papers)',
      headquarters: 'Secunderabad, Telangana',
      marketPositioning: 'Market leader in virgin value-added paperboards and sustainable barrier packaging across FMCG & Pharma.',
      sustainabilityClaims: '100% FSC certified options, FiloPack/FiloServe plastic-substitute range, Zero-solid-waste Bhadrachalam mill.',
      strengths: ['Integrated pulp mill scale at Bhadrachalam', 'Deep pharma & FMCG converter relationships', 'Strong barrier board portfolio'],
      weaknesses: ['Longer custom-reel MOQs for mid-tier converters', 'Higher base list price in commodity WPP'],
      website: 'https://www.itcpspd.com',
      sourceName: 'Public Annual Report & Product Catalogue (Simulated Baseline)',
      sourceDate: '2026-03-31',
      verificationStatus: 'Verified',
      isSimulated: true,
    },
    {
      name: 'Tamil Nadu Newsprint & Papers (TNPL)',
      headquarters: 'Chennai, Tamil Nadu',
      marketPositioning: 'Bagasse-based eco-friendly printing & writing paper producer expanding into multi-layer coated packaging boards.',
      sustainabilityClaims: 'Agri-residue bagasse pulp leadership reducing wood fiber dependency.',
      strengths: ['Cost-competitive bagasse pulp integration', 'Strong institutional & state textbook presence in South India'],
      weaknesses: ['Limited North/West warehouse density for fast FBB replenishment', 'Slightly lower bulk stiffness on bagasse-blend grades'],
      website: 'https://www.tnpl.com',
      sourceName: 'Public Investor Presentation (Simulated Baseline)',
      sourceDate: '2026-02-15',
      verificationStatus: 'Verified',
      isSimulated: true,
    },
    {
      name: 'Century Pulp & Paper',
      headquarters: 'Lalkua, Uttarakhand',
      marketPositioning: 'Broad-line North India producer across copier, writing/printing, tissue, and prime packaging board.',
      sustainabilityClaims: 'Social forestry fiber sourcing and ECF bleaching compliance.',
      strengths: ['Proximity to Delhi NCR & North printing clusters', 'Competitive copier and tissue bundling'],
      weaknesses: ['Lower specialty aqueous barrier portfolio compared to tier-1 leaders'],
      website: 'https://www.centurypulpandpaper.com',
      sourceName: 'Industry Trade Directory (Simulated Baseline)',
      sourceDate: '2026-01-20',
      verificationStatus: 'Pending Review',
      isSimulated: true,
    },
    {
      name: 'West Coast Paper Mills (WCPM)',
      headquarters: 'Dandeli, Karnataka',
      marketPositioning: 'Established Southern India producer across writing/printing, copier, and cupstock/duplex boards.',
      sustainabilityClaims: 'Captive plantation wood sourcing and ISO 14001 environmental management at Dandeli.',
      strengths: ['Strong South & West dealer distribution', 'Competitive maplitho and cupstock pricing'],
      weaknesses: ['Lower national brand recall in executive A4 office segments vs tier-1 national brands'],
      website: 'https://www.westcoastpaper.com',
      sourceName: 'Investor Presentation & Dealer Survey (Simulated Baseline)',
      sourceDate: '2026-03-10',
      verificationStatus: 'Verified',
      isSimulated: true,
    },
    {
      name: 'Kuantum Papers Ltd',
      headquarters: 'Sailakhurd, Punjab',
      marketPositioning: 'North India agro- and wood-based writing, printing, and specialty paper supplier.',
      sustainabilityClaims: 'Wheat-straw agro-pulp blending and backward chemical recovery integration.',
      strengths: ['Strong freight advantage into Baddi, Delhi NCR, and Rajasthan', 'Flexible specialty creamwove runs'],
      weaknesses: ['No virgin multi-layer FBB/SBS packaging board capacity'],
      website: 'https://www.kuantumpapers.com',
      sourceName: 'North Zone Trade Brief (Simulated Baseline)',
      sourceDate: '2026-02-25',
      verificationStatus: 'Verified',
      isSimulated: true,
    },
    {
      name: 'Emami Paper Mills Ltd',
      headquarters: 'Balasore, Odisha',
      marketPositioning: 'Major Eastern India recycled packaging board and newsprint manufacturer serving FMCG converters.',
      sustainabilityClaims: 'Recycled waste-paper fiber recovery and cogeneration power plant.',
      strengths: ['Cost-effective grey-back and white-back recycled boards', 'Strong East India logistics'],
      weaknesses: ['Recycled fiber limits direct food-contact and high-stiffness virgin FBB tenders'],
      website: 'https://www.emamipaper.in',
      sourceName: 'Eastern Converter Benchmark (Simulated Baseline)',
      sourceDate: '2026-03-05',
      verificationStatus: 'Pending Review',
      isSimulated: true,
    },
  ];

  for (const c of compSpecs) {
    await db.insert(competitors).values(c).onConflictDoNothing({ target: competitors.name });
  }
  const allCompetitors = await db.select().from(competitors);
  const compMap = Object.fromEntries(allCompetitors.map((c) => [c.name, c.id]));

  const [{ total: compProdCount }] = await db.select({ total: count() }).from(competitorProducts);
  if (compProdCount < 6) {
    const existingProdNames = new Set((await db.select({ productName: competitorProducts.productName }).from(competitorProducts)).map((p) => p.productName));
    const cpSeed: Array<typeof competitorProducts.$inferInsert> = [
      { competitorId: compMap['ITC PSPD (Paperboards & Specialty Papers)'], categoryId: catMap['PKB'], categoryName: 'Packaging Boards', productName: 'CyberXL Pac FBB', gsmRange: '220 - 400 GSM', brightness: '85% ISO', pricePerMtInr: '86500.00', specs: { stiffness: 'High Taber', printability: 'Double-coated top' }, sustainabilityCert: 'FSC Mix / PEFC', sourceName: 'Converter Trade Quote Summary (Simulated Baseline)', sourceDate: '2026-04-10', verificationStatus: 'Verified', isSimulated: true },
      { competitorId: compMap['ITC PSPD (Paperboards & Specialty Papers)'], categoryId: catMap['SPP'], categoryName: 'Specialty Paper', productName: 'FiloServe Barrier Board', gsmRange: '180 - 280 GSM', brightness: '83% ISO', pricePerMtInr: '104500.00', specs: { barrier: 'Aqueous recyclable', foodContact: 'USFDA' }, sustainabilityCert: 'FSC Mix · Plastic-Free', sourceName: 'QSR Packaging Benchmark (Simulated Baseline)', sourceDate: '2026-03-22', verificationStatus: 'Verified', isSimulated: true },
      { competitorId: compMap['Tamil Nadu Newsprint & Papers (TNPL)'], categoryId: catMap['WPP'], categoryName: 'Writing & Printing Paper', productName: 'TNPL Radiant Stationery', gsmRange: '58 - 90 GSM', brightness: '89% ISO', pricePerMtInr: '74200.00', specs: { pulpBase: 'Bagasse + Hardwood', opacity: '91%' }, sustainabilityCert: 'Bagasse Eco-Mark', sourceName: 'Dealer Price List Archive (Simulated Baseline)', sourceDate: '2026-03-18', verificationStatus: 'Verified', isSimulated: true },
      { competitorId: compMap['Century Pulp & Paper'], categoryId: catMap['OCP'], categoryName: 'Office & Copier Paper', productName: 'Century Star Copier', gsmRange: '70 - 80 GSM', brightness: '91% ISO', pricePerMtInr: '79800.00', specs: { jamFreeRating: '99.9%' }, sustainabilityCert: 'FSC Mix', sourceName: 'North Zone Wholesale Survey (Simulated Baseline)', sourceDate: '2026-02-28', verificationStatus: 'Pending Review', isSimulated: true },
      { competitorId: compMap['West Coast Paper Mills (WCPM)'], categoryId: catMap['OCP'], categoryName: 'Office & Copier Paper', productName: 'Wesco B2B Copier', gsmRange: '70 - 75 GSM', brightness: '91% ISO', pricePerMtInr: '78500.00', specs: { finish: 'Smooth laser/inkjet' }, sustainabilityCert: 'FSC Mix', sourceName: 'South-West Dealer Survey (Simulated Baseline)', sourceDate: '2026-03-10', verificationStatus: 'Verified', isSimulated: true },
      { competitorId: compMap['Kuantum Papers Ltd'], categoryId: catMap['WPP'], categoryName: 'Writing & Printing Paper', productName: 'Kuantum Krestel Maplitho', gsmRange: '60 - 120 GSM', brightness: '90% ISO', pricePerMtInr: '73500.00', specs: { pulpBase: 'Agro + Wood' }, sustainabilityCert: 'ECF Agro-Blend', sourceName: 'Punjab & NCR Print Trade Quote (Simulated Baseline)', sourceDate: '2026-02-25', verificationStatus: 'Verified', isSimulated: true },
      { competitorId: compMap['Emami Paper Mills Ltd'], categoryId: catMap['PKB'], categoryName: 'Packaging Boards', productName: 'Emami EcoPac GreyBack', gsmRange: '230 - 450 GSM', brightness: '80% ISO', pricePerMtInr: '64000.00', specs: { fiber: '100% Recycled' }, sustainabilityCert: 'Recycled Fiber Certified', sourceName: 'East Zone Converter Sheet (Simulated Baseline)', sourceDate: '2026-03-05', verificationStatus: 'Pending Review', isSimulated: true },
    ];
    const missingCp = cpSeed.filter((p) => p.competitorId && !existingProdNames.has(p.productName));
    if (missingCp.length > 0) await db.insert(competitorProducts).values(missingCp);
  }

  // 9. Sales Records (ensure all 12 regions have 6 months of simulated baseline sales)
  const [{ total: salesCount }] = await db.select({ total: count() }).from(salesRecords);
  if (salesCount < 60) {
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const existingRegionSales = new Set(
      (await db.select({ regionId: salesRecords.regionId }).from(salesRecords)).map((s) => s.regionId)
    );
    const regionSalesBase: Record<string, { mt: number; cat: string; prod: string }> = {
      Maharashtra: { mt: 1850, cat: 'Writing & Printing Paper', prod: 'UltraOpaque Maplitho' },
      Gujarat: { mt: 1420, cat: 'Packaging Boards', prod: 'StiffCore Virgin FBB' },
      'Delhi NCR': { mt: 1690, cat: 'Office & Copier Paper', prod: 'ProPrint A4 Copier' },
      Telangana: { mt: 1210, cat: 'Packaging Boards', prod: 'StiffCore Virgin FBB' },
      Karnataka: { mt: 980, cat: 'Specialty Paper', prod: 'AquaShield Barrier Cupstock' },
      'Tamil Nadu': { mt: 1340, cat: 'Writing & Printing Paper', prod: 'UltraOpaque Maplitho' },
      'West Bengal': { mt: 760, cat: 'Office & Copier Paper', prod: 'ProPrint A4 Copier' },
      'Madhya Pradesh': { mt: 610, cat: 'Office & Copier Paper', prod: 'ValuePrint Copier 70' },
      'Himachal Pradesh': { mt: 890, cat: 'Packaging Boards', prod: 'StiffCore Virgin FBB' },
      Rajasthan: { mt: 710, cat: 'Office & Copier Paper', prod: 'ProPrint A4 Copier' },
      'Uttar Pradesh': { mt: 820, cat: 'Writing & Printing Paper', prod: 'HiWhite Offset 80' },
      Odisha: { mt: 540, cat: 'Specialty Paper', prod: 'AquaShield Barrier Cupstock' },
    };
    const salesToInsert: Array<typeof salesRecords.$inferInsert> = [];
    for (const [state, info] of Object.entries(regionSalesBase)) {
      const reg = regMap[state];
      if (!reg || existingRegionSales.has(reg.id)) continue;
      for (let i = 0; i < months.length; i++) {
        const vol = Math.round(info.mt * (1 + i * 0.035));
        salesToInsert.push({
          regionId: reg.id,
          productId: prodMap[info.prod] ?? null,
          productCategoryName: info.cat,
          periodMonth: months[i],
          volumeMt: vol.toFixed(2),
          revenueInrLakhs: Math.round(vol * 0.84).toFixed(2),
          isSimulated: true,
        });
      }
    }
    if (salesToInsert.length > 0) await db.insert(salesRecords).values(salesToInsert);
  }

  // 10. Opportunities (ensure top regions are scored)
  const [{ total: oppCount }] = await db.select({ total: count() }).from(opportunities);
  if (oppCount < 8) {
    const existingOppRegions = new Set((await db.select({ regionId: opportunities.regionId }).from(opportunities)).map((o) => o.regionId));
    const oppToInsert = allRegions
      .filter((r) => !existingOppRegions.has(r.id))
      .map((r) => {
        const d = Number(r.demandPotentialScore);
        const g = Number(r.salesGrowthScore);
        const c = Number(r.customerDensityScore);
        const gap = Number(r.distributionGapScore);
        const compOpp = 100 - Number(r.competitorPresenceScore);
        const score = d * 0.3 + g * 0.2 + c * 0.2 + gap * 0.15 + compOpp * 0.15;
        return {
          regionId: r.id,
          productCategoryId: catMap['PKB'],
          productCategoryName: 'Packaging Boards',
          title: `${r.stateName} (${r.cityName}) Growth Opportunity`,
          opportunityScore: score.toFixed(2),
          demandScore: d.toFixed(2),
          growthScore: g.toFixed(2),
          densityScore: c.toFixed(2),
          distributionGapScore: gap.toFixed(2),
          competitiveScore: compOpp.toFixed(2),
          rationale: `Demand potential (${d}), sales growth (${g}), and distribution gap (${gap}) across ${r.cityName}.`,
          recommendedNextSteps: [
            `Onboard 3-5 Tier-1 converters or wholesale dealers in ${r.cityName}`,
            'Run technical printability & barrier trials with StiffCore Virgin FBB and AquaShield Barrier Cupstock',
          ],
          weightsSnapshot: { demandPotential: 30, salesGrowth: 20, customerDensity: 20, distributionGap: 15, competitiveOpportunity: 15 },
          status: 'Identified',
          isSimulated: true,
        };
      });
    if (oppToInsert.length > 0) await db.insert(opportunities).values(oppToInsert);
  }

  // 11. Knowledge Hub Sample Documents (3 authentic industry & mill sustainability briefs with embeddings)
  const [{ total: docCount }] = await db.select({ total: count() }).from(documents);
  if (docCount === 0) {
    const sampleDocs = [
      {
        title: 'India Paper & Virgin Packaging Board Market Outlook (FY2026-27)',
        fileName: 'india_paper_packaging_outlook_fy26_27.pdf',
        fileType: 'pdf',
        fileSize: 248600,
        category: 'Market Research',
        productCategory: 'Packaging Boards',
        region: 'All India',
        industry: 'Packaging',
        rawSummary: 'Industry brief tracking Indian virgin folding box board (FBB) 9.4% CAGR, organized office copier resilience, and rising pharma serialization demand across Baddi, Hyderabad, and Vapi clusters.',
        extractedFacts: [
          'Indian virgin packaging board demand is growing at ~9.4% CAGR driven by FMCG, pharma, and quick-commerce cartons.',
          'Pharmaceutical hubs in Hyderabad and Baddi require high-stiffness virgin FBB (280-350 GSM) compatible with high-speed Bobst die-cutters and 2D QR serialization.',
          'Writing & printing paper demand stabilizes at 4-5% annual growth supported by K-12 textbook refreshes and state curriculum revisions.',
        ],
        sections: [
          {
            pageNumber: 1,
            sectionTitle: 'Page 1 — Executive Market Overview',
            content: 'India remains one of the fastest-growing paper and paperboard markets globally. While commodity newsprint faces structural headwinds, virgin Packaging Boards (FBB and SBS) are expanding at an estimated 9.4% CAGR through FY2027, propelled by organized retail, pharmaceutical exports, and FMCG premiumization. Writing and Printing Paper (WPP) maintains steady 4.5% growth driven by National Education Policy textbook updates and competitive exam publishing.',
          },
          {
            pageNumber: 2,
            sectionTitle: 'Page 2 — Regional Demand Clusters',
            content: 'Western India (Mumbai-Pune and Ahmedabad-Vapi) represents 34% of organized converter board consumption, while Southern pharma clusters in Hyderabad and Bengaluru account for high-margin virgin FBB specification demand. Northern hubs including Baddi (Himachal Pradesh) and Delhi NCR show rising demand for 280-350 GSM pharmaceutical mono-cartons and 70-80 GSM ColorLok office copier papers.',
          },
          {
            pageNumber: 3,
            sectionTitle: 'Page 3 — Buyer Procurement Shifts',
            content: 'Enterprise converters increasingly prioritize consistent Taber stiffness, moisture-wrapped pallet protection during monsoon transit, and reliable 48-72 hour regional depot replenishment over marginal spot-price discounts. Imported FBB spot volatility creates windows for integrated domestic mills with captive pulp.',
          },
        ],
      },
      {
        title: 'Single-Use Plastic Ban & Aqueous Barrier Cupstock Adoption in India',
        fileName: 'sup_ban_aqueous_barrier_qsr_study.pdf',
        fileType: 'pdf',
        fileSize: 192400,
        category: 'Regulatory',
        productCategory: 'Specialty Paper',
        region: 'South',
        industry: 'Food & Beverage',
        rawSummary: 'Assessment of CPCB single-use plastic enforcement and rapid QSR migration from LDPE-lined board to PFAS-free aqueous dispersion coated cupstock.',
        extractedFacts: [
          'Urban QSR and beverage chains in Bengaluru, Mumbai, and Delhi NCR are actively piloting PFAS-free aqueous barrier cupstock to replace LDPE-coated cups.',
          'Converters require drop-in sealability on existing cup-forming machines at 100-140 cups/minute without major tooling capex.',
          'Recyclability certification and USFDA food-contact compliance are top buyer criteria for national food-service brands.',
        ],
        sections: [
          {
            pageNumber: 1,
            sectionTitle: 'Page 1 — Regulatory Catalyst',
            content: 'Following CPCB Extended Producer Responsibility (EPR) and state-level Single-Use Plastic (SUP) enforcement across Karnataka, Maharashtra, and Delhi NCR, major QSR and cloud-kitchen brands are mandating plastic-free, repulpable paperboard alternatives for hot/cold beverage cups and takeaway meal trays.',
          },
          {
            pageNumber: 2,
            sectionTitle: 'Page 2 — Technical & Commercial Economics',
            content: 'Aqueous dispersion barrier coated cupstock (170-260 GSM) such as AquaShield Barrier Cupstock offers 100% repulpability without LDPE plastic film delamination. Cup converters evaluate suppliers primarily on heat-seal window consistency, edge-wicking resistance over 4+ hours, and PFAS-free food-contact safety certifications.',
          },
        ],
      },
      {
        title: 'Integrated Mill Network & Sustainability Footprint Brief (East, West, South)',
        fileName: 'integrated_mill_sustainability_footprint_brief.docx',
        fileType: 'docx',
        fileSize: 145200,
        category: 'Internal Brief',
        productCategory: 'All Categories',
        region: 'All India',
        industry: 'All Industries',
        rawSummary: 'Internal marketing reference summarizing integrated pulp self-sufficiency, social farm forestry coverage, and regional freight corridors across Eastern, Western, and Southern mill hubs.',
        extractedFacts: [
          'Integrated paper & board manufacturing hubs operate across Eastern, Western, and Southern India demand corridors.',
          'Social farm forestry programs cover over 1.2 lakh hectares around mill catchment areas, strengthening FSC Mix and ECF sustainability credentials.',
          'Western mill hub proximity provides sub-48-hour transit advantage to Gujarat and Maharashtra packaging converters.',
        ],
        sections: [
          {
            pageNumber: 1,
            sectionTitle: 'Section 1 — Integrated Mill Network',
            content: 'Modern Indian paper and packaging producers leverage three strategic manufacturing corridors: an Eastern integrated mill hub serving pan-India copier and WPP markets, a Western hub anchored for Gujarat and Maharashtra virgin FBB/SBS packaging converters, and a Southern mill hub supporting regional publishing and specialty paper demand.',
          },
          {
            pageNumber: 2,
            sectionTitle: 'Section 2 — Sustainability & Forestry Advantage',
            content: 'Over 90% of wood fiber is sourced through clonal social farm forestry within mill catchment zones, creating a verified carbon-positive story for B2B buyers. Elemental Chlorine Free (ECF) bleaching and FSC Mix certifications are critical differentiators in FMCG and global export pharma tenders.',
          },
        ],
      },
    ];

    for (const d of sampleDocs) {
      const [insertedDoc] = await db
        .insert(documents)
        .values({
          title: d.title,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          category: d.category,
          productCategory: d.productCategory,
          region: d.region,
          industry: d.industry,
          status: 'indexed',
          pageCount: d.sections.length,
          chunkCount: d.sections.length,
          rawSummary: d.rawSummary,
          extractedFacts: d.extractedFacts,
        })
        .returning();

      const chunkValues: Array<typeof documentChunks.$inferInsert> = [];
      for (let i = 0; i < d.sections.length; i++) {
        const sec = d.sections[i];
        let embedding: number[] | null = null;
        try {
          if (process.env.GEMINI_API_KEY) {
            embedding = await generateEmbedding(sec.content);
          }
        } catch {
          // Safe fallback to keyword retrieval if embedding call skips
        }
        chunkValues.push({
          documentId: insertedDoc.id,
          chunkIndex: i,
          pageNumber: sec.pageNumber,
          sectionTitle: sec.sectionTitle,
          content: sec.content,
          tokenCount: Math.ceil(sec.content.split(/\s+/).length * 1.3),
          embedding,
        });
      }
      await db.insert(documentChunks).values(chunkValues);
    }
  }

  // 12. Campaigns (ensure 4 realistic campaigns across workflow states)
  const [{ total: campCount }] = await db.select({ total: count() }).from(campaigns);
  if (campCount < 3) {
    const existingCampNames = new Set((await db.select({ name: campaigns.name }).from(campaigns)).map((c) => c.name));
    const campSeeds = [
      {
        name: 'AquaShield QSR Plastic-Replacement Drive',
        campaignType: 'Sustainable packaging awareness',
        productId: prodMap['AquaShield Barrier Cupstock'] ?? null,
        productName: 'AquaShield Barrier Cupstock',
        targetAudience: 'QSR Chains & Beverage Cup Converters',
        industry: 'Food & Beverage',
        region: 'Karnataka & Maharashtra',
        objective: 'Convert 18 regional cup converters from PE-coated board to PFAS-free AquaShield Barrier Cupstock.',
        budgetInr: '1850000.00',
        durationWeeks: 12,
        status: 'active',
        persona: 'Head of Packaging Procurement at multi-city QSR & food-service converters.',
        valueProposition: 'Drop-in aqueous barrier performance on existing cup-forming lines with 100% plastic-free compliance.',
        keyMessage: 'Zero Plastic Liner. Full Speed Runnability. Certified Food-Safe Packaging.',
        channels: [
          { channel: 'Converter Technical Workshops', rationale: 'Live cup-sealing trials drive fastest B2B qualification', sharePercent: 45 },
          { channel: 'LinkedIn B2B Account-Based Outreach', rationale: 'Reaches FMCG & QSR sustainability heads', sharePercent: 30 },
          { channel: 'PackTech Expo Booth', rationale: 'Direct sample kit distribution', sharePercent: 25 },
        ],
        budgetAllocation: [
          { item: 'Sample Reel Trials & Lab Audits', amountInr: 832500, sharePercent: 45 },
          { item: 'Digital ABM & Content Assets', amountInr: 555000, sharePercent: 30 },
          { item: 'Regional Converter Roadshows', amountInr: 462500, sharePercent: 25 },
        ],
        calendar: [
          { week: 'Weeks 1-3', milestone: 'Converter Shortlist & Sample Kit Dispatch', deliverable: '40 trial kits shipped' },
          { week: 'Weeks 4-8', milestone: 'On-site Machine Trials in Bengaluru & Pune', deliverable: '15 plant runnability sign-offs' },
          { week: 'Weeks 9-12', milestone: 'Commercial Contract Conversion', deliverable: 'Quarterly supply MOUs' },
        ],
        kpis: [{ metric: 'Qualified Converter Trials', target: '25 plants' }, { metric: 'Contracted Annual Volume', target: '1,200 MT' }],
        expectedOutcomes: ['1,200 MT incremental annual run-rate', '18% lower acquisition cost vs cold field outreach'],
        assumptions: ['State SUP enforcement continues across Karnataka and Maharashtra', 'Plant trial conversion rate assumed at 45%'],
        isSimulated: true,
      },
      {
        name: 'Baddi & Hyderabad Pharma FBB Precision Trial Program',
        campaignType: 'B2B lead generation',
        productId: prodMap['StiffCore Virgin FBB'] ?? null,
        productName: 'StiffCore Virgin FBB',
        targetAudience: 'Pharmaceutical Mono-Carton Converters & Packaging QA Heads',
        industry: 'Pharmaceuticals',
        region: 'Telangana & Himachal Pradesh',
        objective: 'Win 10 new Tier-1 pharma carton converters by demonstrating Bobst die-cutting stiffness and 72-hour depot replenishment.',
        budgetInr: '1400000.00',
        durationWeeks: 10,
        status: 'approved',
        persona: 'VP Operations & Packaging Quality Assurance Manager at GMP-certified pharma converters.',
        valueProposition: 'High Taber stiffness with crisp 2D QR serialization drying and dependable Western/regional depot supply.',
        keyMessage: 'Precision Stiffness for High-Speed Pharma Lines.',
        channels: [
          { channel: 'On-Site Mill Engineer Trials', rationale: 'Pharma QA requires live machine verification', sharePercent: 55 },
          { channel: 'PharmaPack Technical Briefs', rationale: 'Targets regulatory & QA stakeholders', sharePercent: 25 },
          { channel: 'Dedicated Key Account Outreach', rationale: 'Direct procurement engagement', sharePercent: 20 },
        ],
        budgetAllocation: [
          { item: 'Trial Pallet Allocation & Technical Support', amountInr: 770000, sharePercent: 55 },
          { item: 'Technical Spec Collateral & Lab Testing', amountInr: 350000, sharePercent: 25 },
          { item: 'Baddi & Hyderabad Converter Roundtables', amountInr: 280000, sharePercent: 20 },
        ],
        calendar: [
          { week: 'Weeks 1-2', milestone: 'Target 30 GMP Pharma Converters', deliverable: 'Account dossier' },
          { week: 'Weeks 3-7', milestone: 'Execute 15 Line Trials', deliverable: 'Die-cut & QR print QA reports' },
          { week: 'Weeks 8-10', milestone: 'Annual Rate Contract Sign-Off', deliverable: '10 new converter accounts' },
        ],
        kpis: [{ metric: 'Completed Plant Trials', target: '15 converters' }, { metric: 'Monthly FBB Offtake', target: '650 MT/mo' }],
        expectedOutcomes: ['650 MT/month recurring virgin FBB volume', 'Reduced dependency on imported spot boards'],
        assumptions: ['Hyderabad & North hub buffer stock supports 3-ton custom sheet orders'],
        isSimulated: true,
      },
      {
        name: 'ProPrint Exam-Season Dealer & Institutional Engagement',
        campaignType: 'Dealer engagement',
        productId: prodMap['ProPrint A4 Copier'] ?? null,
        productName: 'ProPrint A4 Copier',
        targetAudience: 'Regional Paper Distributors & Coaching Center Buyers',
        industry: 'Education',
        region: 'Rajasthan, Uttar Pradesh & Madhya Pradesh',
        objective: 'Expand Tier-2 dealer share in Central & North coaching corridors ahead of Q1 academic print cycle.',
        budgetInr: '950000.00',
        durationWeeks: 8,
        status: 'pending_approval',
        persona: 'Wholesale paper distributor managing institutional & print-shop accounts in Jaipur, Kota, Indore, and Lucknow.',
        valueProposition: 'Fastest retail turn with ColorLok jam-free reliability and reinforced moisture-resistant shipper cartons.',
        keyMessage: 'Zero Jam Performance. Built for Peak Institutional Demand.',
        channels: [
          { channel: 'Regional Dealer Meets & Slab Incentives', rationale: 'Drives pre-season stocking commitment', sharePercent: 60 },
          { channel: 'Institutional Sample Drops', rationale: 'Converts large coaching & university print rooms', sharePercent: 40 },
        ],
        budgetAllocation: [
          { item: 'Dealer Slab Co-op & Merchandising', amountInr: 570000, sharePercent: 60 },
          { item: 'Institutional Sample Kits & Field Activation', amountInr: 380000, sharePercent: 40 },
        ],
        calendar: [
          { week: 'Weeks 1-2', milestone: 'Dealer Meet in Jaipur & Indore', deliverable: '45 dealers enrolled' },
          { week: 'Weeks 3-6', milestone: 'Institutional Print Room Demos', deliverable: '120 bulk quotes issued' },
          { week: 'Weeks 7-8', milestone: 'Pre-Season Stocking Fulfillment', deliverable: '900 MT booked' },
        ],
        kpis: [{ metric: 'Active Tier-2 Dealers', target: '+18 new dealers' }, { metric: 'Pre-Season Booking', target: '900 MT' }],
        expectedOutcomes: ['+18 active wholesale partners across Central & North Tier-2 hubs'],
        assumptions: ['Reinforced ECT 5-ream master cartons deployed prior to dispatch'],
        isSimulated: true,
      },
    ];

    for (const c of campSeeds) {
      if (existingCampNames.has(c.name)) continue;
      const [insertedCamp] = await db.insert(campaigns).values(c).returning();
      if (c.status === 'active') {
        await db.insert(campaignMetrics).values([
          { campaignId: insertedCamp.id, metricDate: '2026-09-15', impressions: 42000, leadsGenerated: 64, dealerInquiries: 14, conversions: 6, spendInr: '410000.00', roiPercent: '142.00', isSimulated: true },
          { campaignId: insertedCamp.id, metricDate: '2026-10-15', impressions: 68500, leadsGenerated: 112, dealerInquiries: 26, conversions: 13, spendInr: '890000.00', roiPercent: '198.00', isSimulated: true },
        ]);
      } else if (c.status === 'approved') {
        await db.insert(campaignMetrics).values([
          { campaignId: insertedCamp.id, metricDate: '2026-10-20', impressions: 18500, leadsGenerated: 31, dealerInquiries: 9, conversions: 4, spendInr: '240000.00', roiPercent: '165.00', isSimulated: true },
        ]);
      }
    }
  }

  // 13. Pre-generated Sample Executive Reports (2 reports)
  const [{ total: repCount }] = await db.select({ total: count() }).from(reports);
  if (repCount === 0) {
    await db.insert(reports).values([
      {
        title: 'India Packaging Boards & Sustainable Barrier Opportunity Brief (Baseline)',
        category: 'Market research report',
        executiveSummary: 'Virgin Folding Box Board (FBB) and PFAS-free aqueous barrier cupstock represent the highest-margin expansion vectors across Gujarat, Telangana, Karnataka, and Himachal Pradesh (Baddi).',
        objective: 'Synthesize regional demand signals, converter feedback, and regulatory tailwinds to guide Q4-Q1 packaging capacity allocation.',
        methodology: 'Combined pgvector retrieval across indexed Knowledge Hub briefs with weighted regional scoring (30% Demand / 20% Growth / 20% Density / 15% Gap / 15% Competitive) and live customer feedback analysis.',
        dataSources: [
          'India Paper & Virgin Packaging Board Market Outlook (FY2026-27) [Simulated Baseline]',
          'Single-Use Plastic Ban & Aqueous Barrier Cupstock Adoption in India [Simulated Baseline]',
          'PostgreSQL regional telemetry & customer feedback records',
        ],
        analysis: 'Western and Southern pharma and FMCG clusters continue shifting toward virgin high-stiffness FBB (230-400 GSM) and repulpable aqueous barrier grades. Integrated mills with Western freight agility into Vapi/Mumbai and strong Eastern/Southern depot coverage hold clear replenishment advantages.',
        chartData: [
          { label: 'Telangana', value: 84.4, unit: 'Score' },
          { label: 'Gujarat', value: 80.9, unit: 'Score' },
          { label: 'Himachal (Baddi)', value: 80.3, unit: 'Score' },
          { label: 'Karnataka', value: 74.7, unit: 'Score' },
          { label: 'Maharashtra', value: 73.5, unit: 'Score' },
        ],
        keyFindings: [
          'Hyderabad (Telangana) and Baddi (Himachal Pradesh) exhibit the strongest combination of pharma demand potential and distribution gap.',
          'QSR converters strongly favor PFAS-free aqueous cupstock that runs on existing cup-forming tooling without capex.',
          'Custom 3-ton sheet MOQs and 72-hour depot buffer stock are the top service differentiators requested by pharma converters.',
        ],
        recommendations: [
          'Establish 72-hour buffer stock for StiffCore Virgin FBB at Hyderabad and North hubs.',
          'Scale technical workshop trials for AquaShield Barrier Cupstock across Karnataka and Maharashtra QSR converters.',
          'Deploy quarterly volume rebate slabs for >400 MT/month Gujarat FMCG converters.',
        ],
        assumptions: [
          'Regional demand and sales growth scores reflect simulated baseline telemetry until ERP actuals are imported.',
          'CPCB SUP enforcement timeline remains active across Tier-1 municipalities.',
        ],
        limitations: [
          'Competitor list prices are simulated trade benchmarks pending verified quarterly distributor invoices.',
        ],
      },
      {
        title: 'Customer Satisfaction & Quality Pain-Point Diagnostic (Baseline)',
        category: 'Customer sentiment report',
        executiveSummary: 'Overall customer satisfaction averages 4.0+/5.0 led by runnability and sustainability certifications, with targeted improvement opportunities in monsoon shipper packaging, custom sheet MOQs, and coastal pallet moisture protection.',
        objective: 'Quantify sentiment polarity, recurring operational pain points, and most requested product/service enhancements across active B2B customer accounts.',
        methodology: 'Automated classification and frequency aggregation across validated, SHA-256 deduplicated customer feedback records.',
        dataSources: ['PostgreSQL customer_feedback table (14 simulated baseline B2B survey & manual records)'],
        analysis: 'Quality and sustainability feedback for UltraOpaque Maplitho, AquaShield Barrier Cupstock, and ProPrint A4 Copier is predominantly positive (92%+ satisfaction on runnability and brightness). Negative/neutral outliers cluster around monsoon carton crushing in Delhi NCR, edge-wave in coastal Tamil Nadu, and spot price pressure against Indonesian A4 imports.',
        chartData: [
          { label: 'Positive', value: 9, unit: 'Records' },
          { label: 'Neutral', value: 2, unit: 'Records' },
          { label: 'Negative', value: 3, unit: 'Records' },
        ],
        keyFindings: [
          'High-speed runnability and brightness (90-96% ISO) drive strong repeat preference.',
          'Packaging & transit humidity (monsoon carton crushing, coastal edge-wave) account for key preventable quality complaints.',
          'Price sensitivity is concentrated in commodity copier tenders and Gujarat spot FBB accounts.',
        ],
        recommendations: [
          'Upgrade 5-ream outer shipper boxes to higher ECT board ahead of monsoon dispatches.',
          'Introduce stretch-hood moisture wrapping for South coastal coated paper routes.',
          'Bundle quarterly volume rebates instead of cutting headline list prices.',
        ],
        assumptions: ['Baseline survey sample reflects representative feedback across key segments until CSV/Excel customer exports are uploaded.'],
        limitations: ['Sample size is 14 baseline records; statistical confidence improves as regional sales teams import quarterly surveys.'],
      },
    ]);
  }

  // 14. Sample AI Interactions & Notifications
  const [{ total: aiCount }] = await db.select({ total: count() }).from(aiInteractions);
  if (aiCount === 0) {
    await db.insert(aiInteractions).values([
      {
        module: 'assistant',
        prompt: 'Which regions show the strongest packaging board opportunity?',
        response: 'Based on live regional scoring, Telangana (Hyderabad Pharma Hub) and Gujarat (Ahmedabad & Vapi) lead for Packaging Boards, followed closely by Himachal Pradesh (Baddi Pharma Belt). Telangana combines a 91/100 demand potential score with a 76/100 distribution gap, while Baddi shows an 84/100 distribution gap for custom pharma FBB sheets.',
        citations: [
          {
            source: 'India Paper & Virgin Packaging Board Market Outlook (FY2026-27)',
            pageOrSection: 'Page 2 — Regional Demand Clusters',
            excerpt: 'Southern pharma clusters in Hyderabad and Bengaluru account for high-margin virgin FBB specification demand.',
          },
        ],
        assumptions: ['Scoring uses default 30/20/20/15/15 weights across simulated baseline regional metrics.'],
        reasoning: 'Ranked regions by weighted opportunity score and cross-referenced against pharma/FMCG cluster notes in Knowledge Hub.',
      },
    ]);
  }

  const [{ total: notifCount }] = await db.select({ total: count() }).from(notifications);
  if (notifCount === 0) {
    await db.insert(notifications).values([
      {
        title: 'Sample Knowledge Hub Reports Indexed',
        message: '3 baseline paper & packaging sustainability briefs are ready for semantic RAG search and citation.',
        type: 'success',
        module: 'Knowledge Hub',
        isRead: false,
      },
      {
        title: 'Campaign Pending Leadership Approval',
        message: '"ProPrint Exam-Season Dealer & Institutional Engagement" is awaiting Marketing Head / Admin approval.',
        type: 'warning',
        module: 'AI Campaign Studio',
        isRead: false,
      },
      {
        title: 'Simulated Baseline Data Notice',
        message: 'Initial baseline metrics are marked as Simulated. Upload PDF/Excel reports or log customer feedback to blend live enterprise records.',
        type: 'info',
        module: 'System',
        isRead: false,
      },
    ]);
  }

  // 15. Backfill pgvector embeddings for any sample chunks created without API key
  if (process.env.GEMINI_API_KEY) {
    const unembedded = await db
      .select({ id: documentChunks.id, content: documentChunks.content })
      .from(documentChunks)
      .where(isNull(documentChunks.embedding))
      .limit(25);
    for (const chunk of unembedded) {
      try {
        const vec = await generateEmbedding(chunk.content);
        await db
          .update(documentChunks)
          .set({ embedding: vec })
          .where(eq(documentChunks.id, chunk.id));
      } catch {
        break;
      }
    }
  }
}

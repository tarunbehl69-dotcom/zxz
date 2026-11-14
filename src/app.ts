import express from 'express';
import { adminRouter } from './api/admin.ts';
import { assistantRouter } from './api/assistant.ts';
import { campaignsRouter } from './api/campaigns.ts';
import { competitorsRouter } from './api/competitors.ts';
import { customersRouter } from './api/customers.ts';
import { dashboardRouter } from './api/dashboard.ts';
import { knowledgeRouter } from './api/knowledge.ts';
import { marketRouter } from './api/market.ts';
import { regionalRouter } from './api/regional.ts';
import { reportsRouter } from './api/reports.ts';

export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'PaperPulse AI', timestamp: new Date().toISOString() });
  });

  // Mount domain API routers
  app.use('/api', adminRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', knowledgeRouter);
  app.use('/api', marketRouter);
  app.use('/api', customersRouter);
  app.use('/api', competitorsRouter);
  app.use('/api', regionalRouter);
  app.use('/api', campaignsRouter);
  app.use('/api', reportsRouter);
  app.use('/api', assistantRouter);

  // Unknown /api route handler returning JSON
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}

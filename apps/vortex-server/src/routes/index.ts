import { Router } from 'express';
import type { AppContext } from '../context.js';
import { createAuthRoutes } from '../auth/auth.routes.js';
import { createDbRoutes } from '../db/db.routes.js';
import { createStorageRoutes } from '../storage/storage.routes.js';
import { createAppsRoutes } from '../apps/apps.routes.js';
import { createFunctionsRoutes } from '../functions/functions.routes.js';
import { createSqlRoutes } from '../sql/sql.routes.js';
import { createPolicyRoutes } from '../policies/policies.routes.js';
import { createInsightsRoutes } from '../governance/insights.routes.js';
import { createNotificationRoutes } from '../notifications/notification.routes.js';
import { createWebhookRoutes } from '../webhooks/webhook.routes.js';
import { createAuditRoutes } from '../audit/audit.routes.js';

/** Mount every /v1 API family onto one router. */
export function createApiRouter(ctx: AppContext): Router {
  const router = Router();
  router.use('/auth', createAuthRoutes(ctx));
  router.use('/db', createDbRoutes(ctx));
  router.use('/storage', createStorageRoutes(ctx));
  router.use('/apps', createAppsRoutes(ctx));
  router.use('/functions', createFunctionsRoutes(ctx));
  router.use('/sql', createSqlRoutes(ctx));
  router.use('/policies', createPolicyRoutes(ctx));
  router.use('/insights', createInsightsRoutes(ctx));
  router.use('/notifications', createNotificationRoutes(ctx));
  router.use('/webhooks', createWebhookRoutes(ctx));
  router.use('/audit', createAuditRoutes(ctx));
  return router;
}

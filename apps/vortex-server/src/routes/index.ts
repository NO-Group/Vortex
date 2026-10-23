import { Router } from 'express';
import type { AppContext } from '../context.js';
import { createAuthRoutes } from '../auth/auth.routes.js';
import { createDbRoutes } from '../db/db.routes.js';
import { createStorageRoutes } from '../storage/storage.routes.js';

/** Mount every /v1 API family onto one router. */
export function createApiRouter(ctx: AppContext): Router {
  const router = Router();
  router.use('/auth', createAuthRoutes(ctx));
  router.use('/db', createDbRoutes(ctx));
  router.use('/storage', createStorageRoutes(ctx));
  return router;
}

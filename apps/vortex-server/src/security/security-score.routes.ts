import { Router } from 'express';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { SecurityScoreService } from './security-score.service.js';
import { EncryptionService } from './encryption.service.js';
import type { TokenConfig } from '../auth/tokens.js';

/**
 * `/v1/security` — security posture scoring and encryption info.
 */
export function createSecurityRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const scorer = new SecurityScoreService(ctx.db);
  const encryption = new EncryptionService(ctx.env.jwt.secret);

  /** GET /v1/security/score — get security score for the current user. */
  router.get('/score', auth, async (req, res, next) => {
    try {
      const score = await scorer.calculate(req.auth!.sub);
      // Record the score
      void scorer.record(req.auth!.sub, score);
      res.json(score);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/security/history — get historical security scores. */
  router.get('/history', auth, async (req, res, next) => {
    try {
      const history = await scorer.getHistory(req.auth!.sub, 30);
      res.json({ history });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/security/encryption — get encryption at rest info. */
  router.get('/encryption', async (_req, res) => {
    res.json({
      algorithm: encryption.getAlgorithm(),
      keyVersion: encryption.getKeyVersion(),
      atRest: true,
      fields: ['api_keys.secret', 'webhooks.signing_secret', 'functions.source'],
    });
  });

  return router;
}

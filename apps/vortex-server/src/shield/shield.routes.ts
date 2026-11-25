import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ShieldService } from './shield.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const attestSchema = z.object({
  attestationType: z.enum(['app_check', 'play_integrity', 'safety_net']),
  payload: z.record(z.unknown()),
});

const signatureSchema = z.object({
  algorithm: z.enum(['hmac-sha256', 'hmac-sha512']).default('hmac-sha256'),
  signature: z.string().min(1).max(2048),
  timestamp: z.number().int().positive(),
  method: z.string().min(1).max(10).optional(),
  path: z.string().min(1).max(256).optional(),
  body: z.string().max(100000).optional(),
});

const generateSchema = z.object({
  algorithm: z.enum(['hmac-sha256', 'hmac-sha512']).default('hmac-sha256'),
  timestamp: z.number().int().positive(),
  method: z.string().min(1).max(10).optional().default('POST'),
  path: z.string().min(1).max(256).optional().default('/'),
  body: z.string().max(100000).optional().default(''),
});

/**
 * `/v1/shield` — security middleware: AppCheck attestation, IP throttling,
 * and request signature verification.
 *
 * POST /attest      — verify a client attestation
 * GET  /attestations — list recent attestations
 * POST /signature/verify — verify a request signature
 * POST /signature/generate — generate a signature (for client setup)
 * GET  /throttle    — check current IP throttle status
 * GET  /health      — shield health check
 */
export function createShieldRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const shield = new ShieldService(ctx.db, {
    secretKey: ctx.env.jwt.secret, // reuse JWT secret as default
  });

  /** POST /v1/shield/attest — verify a client attestation. */
  router.post('/attest', auth, validateBody(attestSchema), async (req, res, next) => {
    try {
      const row = await shield.verifyAttestation(req.auth!.sub, req.body);
      res.status(200).json({
        valid: true,
        attestation: {
          id: row.id,
          attestationType: row.attestation_type,
          valid: row.valid,
          revision: row.revision,
          expiresAt: row.expires_at?.toISOString() ?? null,
          createdAt: row.created_at.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/shield/attestations — list recent attestations. */
  router.get('/attestations', auth, async (req, res, next) => {
    try {
      const rows = await shield.listAttestations(req.auth!.sub, 20);
      res.json({
        attestations: rows.map((r) => ({
          id: r.id,
          attestationType: r.attestation_type,
          valid: r.valid,
          revision: r.revision,
          createdAt: r.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/shield/signature/verify — verify a request signature. */
  router.post('/signature/verify', auth, validateBody(signatureSchema), async (req, res, next) => {
    try {
      const { algorithm, signature, timestamp } = req.body;
      const method = String(req.body.method ?? req.method);
      const path = String(req.body.path ?? req.path);
      const body = String(req.body.body ?? '');

      const valid = shield.verifySignature(method, path, body, timestamp, signature, algorithm);
      res.json({ valid });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/shield/signature/generate — generate a signature (for client setup). */
  router.post('/signature/generate', auth, validateBody(generateSchema), async (req, res, next) => {
    try {
      const { algorithm, timestamp } = req.body;
      const method = String(req.body.method ?? 'POST');
      const path = String(req.body.path ?? '/v1/shield/signature/generate');
      const body = String(req.body.body ?? '');

      const signature = shield.generateSignature(method, path, body, timestamp, algorithm);
      res.json({ signature, timestamp });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/shield/throttle — check current IP throttle status. */
  router.get('/throttle', auth, async (req, res, next) => {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const status = await shield.getThrottleStatus(ip);
      res.json({ ip, ...status });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/shield/health — shield health check. */
  router.get('/health', async (_req, res) => {
    res.json({
      shield: 'active',
      attestation: 'enabled',
      throttle: 'enabled',
      signature: 'enabled',
    });
  });

  return router;
}

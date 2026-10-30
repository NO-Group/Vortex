import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BiometricService, toAttestation } from './biometric.service.js';
import type { BiometricKind } from '@vortex/core';
import type { TokenConfig } from './tokens.js';

const challengeSchema = z.object({
  kind: z.enum(['facial_liveness', 'fingerprint']).default('facial_liveness'),
});

const verifySchema = z.object({
  challengeId: z.string().min(1).max(128),
  kind: z.enum(['facial_liveness', 'fingerprint']),
  payload: z.record(z.unknown()),
});

/**
 * `/v1/auth/biometric` — biometric facial liveness verification.
 *
 * POST /challenge  — issue a challenge for the user to respond to
 * POST /verify     — verify a liveness-check payload against the challenge
 * GET  /attestations — list recent biometric attestations
 * GET  /attestations/:id — get a single attestation
 */
export function createBiometricRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const biometric = new BiometricService(ctx.db);

  /** POST /v1/auth/biometric/challenge — issue a verification challenge. */
  router.post('/challenge', auth, validateBody(challengeSchema), async (req, res, next) => {
    try {
      const kind = req.body.kind as BiometricKind;
      const challenge = biometric.createChallenge(req.auth!.sub);
      res.status(201).json({ ...challenge, kind });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/biometric/verify — verify a liveness-check payload. */
  router.post('/verify', auth, validateBody(verifySchema), async (req, res, next) => {
    try {
      const { challengeId, kind, payload } = req.body;
      const row = await biometric.verify(req.auth!.sub, { challengeId, kind, payload });
      res.status(200).json({ attestation: toAttestation(row) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/biometric/attestations — list recent attestations. */
  router.get('/attestations', auth, async (req, res, next) => {
    try {
      const rows = await biometric.list(req.auth!.sub, 20);
      res.json({ attestations: rows.map(toAttestation) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/biometric/attestations/:id — get a single attestation. */
  router.get('/attestations/:id', auth, async (req, res, next) => {
    try {
      const row = await biometric.get(req.params.id!);
      if (!row || row.user_id !== req.auth!.sub) {
        res.status(404).json({ error: { code: 'not_found', message: 'Attestation not found' } });
        return;
      }
      res.json({ attestation: toAttestation(row) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

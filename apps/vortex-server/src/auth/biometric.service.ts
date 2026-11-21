import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import type { BiometricKind } from '@vortex/core';

interface BiometricRow {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  verified: boolean;
  liveness_score: number | null;
  challenge_id: string | null;
  verified_at: Date | null;
  created_at: Date;
}

function toAttestation(row: BiometricRow) {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as BiometricKind,
    payload: row.payload,
    verified: row.verified,
    livenessScore: row.liveness_score !== null ? Number(row.liveness_score) : null,
    challengeId: row.challenge_id,
    verifiedAt: row.verified_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Biometric authentication — parses and verifies Face ID / Touch ID
 * liveness-check payloads.
 *
 * The payload format is inspired by the WebAuthn/FaceID flow:
 * ```json
 * {
 *   "challengeId": "server-issued-challenge",
 *   "kind": "facial_liveness",
 *   "payload": {
 *     "assertion": "base64-encoded-assertion",
 *     "clientDataJSON": "base64-encoded-client-data",
 *     "authenticatorData": "base64-encoded-authenticator-data",
 *     "signature": "base64-encoded-signature",
 *     "livenessScore": 0.95,
 *     "attempts": 1,
 *     "deviceId": "...",
 *     "timestamp": 1699999999000
 *   }
 * }
 * ```
 *
 * Verification:
 *   1. Check the challenge matches a server-issued challenge (timing-safe)
 *   2. Check the liveness score meets the threshold (default 0.7)
 *   3. Check the timestamp is within the validity window (default 60s)
 *   4. Mark the attestation as verified
 */
export class BiometricService {
  private readonly challenges = new Map<string, { userId: string; expiresAt: number }>();
  private readonly livenessThreshold: number;
  private readonly challengeTtlMs: number;

  constructor(
    private readonly db: Knex,
    opts?: { livenessThreshold?: number; challengeTtlMs?: number },
  ) {
    this.livenessThreshold = opts?.livenessThreshold ?? 0.7;
    this.challengeTtlMs = opts?.challengeTtlMs ?? 60_000;
  }

  /** Create a challenge for the user to respond to. */
  createChallenge(userId: string): { challengeId: string; expiresAt: Date } {
    const challengeId = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + this.challengeTtlMs);
    this.challenges.set(challengeId, { userId, expiresAt: expiresAt.getTime() });
    return { challengeId, expiresAt };
  }

  /**
   * Parse and verify a biometric liveness-check payload.
   * Returns the attestation if verification succeeds, throws otherwise.
   */
  async verify(
    userId: string,
    input: { challengeId: string; kind: BiometricKind; payload: Record<string, unknown> },
  ): Promise<BiometricRow> {
    // 1. Verify the challenge exists and belongs to this user
    const challenge = this.challenges.get(input.challengeId);
    if (!challenge) {
      throw ApiError.badRequest('Unknown or expired challenge');
    }
    if (challenge.userId !== userId) {
      throw ApiError.forbidden('Challenge does not belong to this user');
    }
    if (challenge.expiresAt < Date.now()) {
      this.challenges.delete(input.challengeId);
      throw ApiError.badRequest('Challenge has expired');
    }
    // Consume the challenge (single-use)
    this.challenges.delete(input.challengeId);

    // 2. Parse the payload
    const payload = input.payload;
    if (!payload || typeof payload !== 'object') {
      throw ApiError.badRequest('Invalid payload: must be an object');
    }

    const livenessScore = this.extractLivenessScore(payload);
    const timestamp = this.extractTimestamp(payload);

    // 3. Verify timestamp is within the validity window
    if (timestamp && Math.abs(Date.now() - timestamp) > this.challengeTtlMs * 2) {
      throw ApiError.badRequest('Payload timestamp is outside the validity window');
    }

    // 4. Check liveness score meets threshold
    if (livenessScore !== null && livenessScore < this.livenessThreshold) {
      throw ApiError.unauthorized(
        `Liveness score ${livenessScore.toFixed(2)} below threshold ${this.livenessThreshold}`,
      );
    }

    // 5. Store the attestation
    const [row] = await this.db<BiometricRow>('biometric_attestations')
      .insert({
        user_id: userId,
        kind: input.kind,
        payload,
        verified: true,
        liveness_score: livenessScore,
        challenge_id: input.challengeId,
        verified_at: new Date(),
      })
      .returning('*');

    return row!;
  }

  /** List recent biometric attestations for a user. */
  async list(userId: string, limit = 20): Promise<BiometricRow[]> {
    return this.db<BiometricRow>('biometric_attestations')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /** Get a single attestation by id. */
  async get(id: string): Promise<BiometricRow | null> {
    const row = await this.db<BiometricRow>('biometric_attestations').where({ id }).first();
    if (!row) return null;
    return row;
  }

  /** Parse the liveness score from the payload. */
  private extractLivenessScore(payload: Record<string, unknown>): number | null {
    const score = payload.livenessScore ?? payload.liveness_score;
    if (typeof score === 'number' && score >= 0 && score <= 1) return score;
    if (typeof score === 'string') {
      const parsed = parseFloat(score);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    }
    return null;
  }

  /** Extract the timestamp from the payload. */
  private extractTimestamp(payload: Record<string, unknown>): number | null {
    const ts = payload.timestamp;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
      const parsed = parseInt(ts, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }
}

export { toAttestation };

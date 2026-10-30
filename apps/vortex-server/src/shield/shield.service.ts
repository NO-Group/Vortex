import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import type { AttestationType } from '@vortex/core';

interface ShieldAttestationRow {
  id: string;
  user_id: string | null;
  attestation_type: string;
  payload: Record<string, unknown>;
  valid: boolean;
  revision: string | null;
  expires_at: Date | null;
  created_at: Date;
}

interface ShieldThrottleRow {
  ip: string;
  request_count: number;
  window_start: number;
  updated_at: Date;
}

/**
 * Shield service — client attestation, IP throttling, and request
 * signature verification.
 *
 * AppCheck-style attestation: verify that the request comes from a
 * genuine app client (not a replay or a third-party caller).
 *
 * IP throttling: sliding-window counter per IP, separate from the
 * global express-rate-limiter.
 *
 * Request signature: HMAC-SHA256/512 verification for API clients that
 * sign their requests.
 */
export class ShieldService {
  private readonly secretKey: string;
  private readonly throttleWindowMs: number;
  private readonly throttleMax: number;
  private readonly signatureTtlMs: number;

  constructor(
    private readonly db: Knex,
    opts?: {
      secretKey?: string;
      throttleWindowMs?: number;
      throttleMax?: number;
      signatureTtlMs?: number;
    },
  ) {
    this.secretKey = opts?.secretKey ?? process.env.SHIELD_SECRET_KEY ?? 'dev-shield-key';
    this.throttleWindowMs = opts?.throttleWindowMs ?? 60_000;
    this.throttleMax = opts?.throttleMax ?? 600;
    this.signatureTtlMs = opts?.signatureTtlMs ?? 300_000;
  }

  // ── Attestation ───────────────────────────────────────────────────────

  /**
   * Verify a client attestation payload (AppCheck / Play Integrity / SafetyNet).
   *
   * For production use, this would call the Google Play Integrity API or
   * Firebase App Check verification endpoint. Here we implement a
   * structural verification + signature check so the hook is complete.
   */
  async verifyAttestation(
    userId: string | null,
    input: {
      attestationType: AttestationType;
      payload: Record<string, unknown>;
    },
  ): Promise<ShieldAttestationRow> {
    const payload = input.payload;
    if (!payload || typeof payload !== 'object') {
      throw ApiError.badRequest('Invalid attestation payload');
    }

    // Structural checks common to all attestation types
    const { token, packageName, deviceId, timestamp } = payload as Record<string, unknown>;

    if (typeof token !== 'string' || token.length < 10) {
      throw ApiError.badRequest('Attestation token is missing or too short');
    }
    if (typeof packageName !== 'string' || !packageName) {
      throw ApiError.badRequest('Package name is required');
    }

    // Verify the attestation signature (HMAC of the token + deviceId)
    const sigPayload = `${token}:${deviceId ?? ''}:${timestamp ?? ''}`;
    const expectedSig = createHmac('sha256', this.secretKey).update(sigPayload).digest('hex');
    const providedSig = payload.signature ?? payload.signatureValue;

    if (typeof providedSig !== 'string' || providedSig.length === 0) {
      throw ApiError.badRequest('Attestation signature is missing');
    }

    // Timing-safe comparison
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const providedBuf = Buffer.from(providedSig, 'hex');
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw ApiError.unauthorized('Attestation signature verification failed');
    }

    // Check timestamp is within the validity window
    const ts = typeof timestamp === 'number' ? timestamp : null;
    if (ts !== null) {
      if (Math.abs(Date.now() - ts) > this.signatureTtlMs) {
        throw ApiError.badRequest('Attestation timestamp is outside the validity window');
      }
    }

    // Store the attestation
    const [row] = await this.db<ShieldAttestationRow>('shield_attestations')
      .insert({
        user_id: userId,
        attestation_type: input.attestationType,
        payload,
        valid: true,
        revision: typeof payload.revision === 'string' ? payload.revision : null,
        expires_at: ts
          ? new Date(ts + this.signatureTtlMs)
          : new Date(Date.now() + this.signatureTtlMs),
      })
      .returning('*');

    return row!;
  }

  /** List recent attestations. */
  async listAttestations(userId: string, limit = 20): Promise<ShieldAttestationRow[]> {
    return this.db<ShieldAttestationRow>('shield_attestations')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  // ── IP Throttling ─────────────────────────────────────────────────────

  /**
   * Check and update the throttle counter for an IP.
   * Returns whether the request should be allowed and the remaining budget.
   */
  async checkThrottle(ip: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.throttleWindowMs;

    const row = await this.db<ShieldThrottleRow>('shield_throttle')
      .where({ ip })
      .first();

    let count: number;
    let windowStartVal: number;

    if (row && row.window_start > windowStart) {
      // Same window — increment
      count = row.request_count + 1;
      windowStartVal = row.window_start;
    } else {
      // New window — reset
      count = 1;
      windowStartVal = now;
    }

    // Upsert
    if (row) {
      await this.db('shield_throttle')
        .where({ ip })
        .update({ request_count: count, window_start: windowStartVal, updated_at: new Date() });
    } else {
      await this.db('shield_throttle').insert({
        ip,
        request_count: count,
        window_start: windowStartVal,
      });
    }

    const allowed = count <= this.throttleMax;
    return {
      allowed,
      remaining: Math.max(0, this.throttleMax - count),
      resetAt: windowStartVal + this.throttleWindowMs,
    };
  }

  /** Get the current throttle status without incrementing. */
  async getThrottleStatus(ip: string): Promise<{
    remaining: number;
    resetAt: number;
    limited: boolean;
  }> {
    const now = Date.now();
    const windowStart = now - this.throttleWindowMs;

    const row = await this.db<ShieldThrottleRow>('shield_throttle')
      .where({ ip })
      .first();

    if (!row || row.window_start <= windowStart) {
      return { remaining: this.throttleMax, resetAt: now + this.throttleWindowMs, limited: false };
    }

    return {
      remaining: Math.max(0, this.throttleMax - row.request_count),
      resetAt: row.window_start + this.throttleWindowMs,
      limited: row.request_count >= this.throttleMax,
    };
  }

  // ── Request Signature Verification ───────────────────────────────────

  /**
   * Verify an HMAC-SHA256/512 request signature.
   *
   * Expected header format:
   *   X-Vortex-Signature: sha256=<hex>
   *   X-Vortex-Timestamp: <epoch-ms>
   *
   * The signature is computed over: method + path + body + timestamp.
   */
  verifySignature(
    method: string,
    path: string,
    body: string,
    timestamp: number,
    signature: string,
    algorithm: 'hmac-sha256' | 'hmac-sha512' = 'hmac-sha256',
  ): boolean {
    // Check timestamp is within the validity window
    if (Math.abs(Date.now() - timestamp) > this.signatureTtlMs) {
      return false;
    }

    const hashAlgo = algorithm === 'hmac-sha512' ? 'sha512' : 'sha256';
    const payload = `${method}:${path}:${body}:${timestamp}`;
    const expected = createHmac(hashAlgo, this.secretKey).update(payload).digest('hex');

    // Strip optional algorithm prefix
    const provided = signature.startsWith(`${algorithm}=`)
      ? signature.slice(algorithm.length + 1)
      : signature;

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');

    return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  }

  /** Generate a signature for a request (for testing / client-side signing). */
  generateSignature(
    method: string,
    path: string,
    body: string,
    timestamp: number,
    algorithm: 'hmac-sha256' | 'hmac-sha512' = 'hmac-sha256',
  ): string {
    const hashAlgo = algorithm === 'hmac-sha512' ? 'sha512' : 'sha256';
    const payload = `${method}:${path}:${body}:${timestamp}`;
    const sig = createHmac(hashAlgo, this.secretKey).update(payload).digest('hex');
    return `${algorithm}=${sig}`;
  }

  /** Get the shared secret key (for client-side signing setup). */
  getSecretKey(): string {
    return this.secretKey;
  }

  /** Generate a random API key for a client. */
  generateApiKey(): string {
    return `vortex_shield_${randomBytes(32).toString('hex')}`;
  }
}

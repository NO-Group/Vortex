import type { HttpClient } from './http.js';
import type { AttestationType, ShieldAttestation, ThrottleStatus } from './types.js';

/**
 * Shield / AppCheck client — `/v1/shield`.
 */
export class Shield {
  constructor(private readonly http: HttpClient) {}

  /** Verify a client attestation (AppCheck / Play Integrity / SafetyNet). */
  async attest(
    attestationType: AttestationType,
    payload: Record<string, unknown>,
  ): Promise<{ valid: boolean; attestation: ShieldAttestation }> {
    return this.http.request<{ valid: boolean; attestation: ShieldAttestation }>(
      '/v1/shield/attest',
      { method: 'POST', body: { attestationType, payload } },
    );
  }

  /** List recent attestations. */
  async listAttestations(): Promise<{ attestations: ShieldAttestation[] }> {
    return this.http.request<{ attestations: ShieldAttestation[] }>('/v1/shield/attestations');
  }

  /** Verify a request signature. */
  async verifySignature(
    method: string,
    path: string,
    body: string,
    timestamp: number,
    signature: string,
    algorithm: 'hmac-sha256' | 'hmac-sha512' = 'hmac-sha256',
  ): Promise<{ valid: boolean }> {
    return this.http.request<{ valid: boolean }>('/v1/shield/signature/verify', {
      method: 'POST',
      body: { method, path, body, timestamp, signature, algorithm },
    });
  }

  /** Generate a signature for a request (for client-side signing). */
  async generateSignature(
    method: string,
    path: string,
    body: string,
    timestamp: number,
    algorithm: 'hmac-sha256' | 'hmac-sha512' = 'hmac-sha256',
  ): Promise<{ signature: string; timestamp: number }> {
    return this.http.request<{ signature: string; timestamp: number }>(
      '/v1/shield/signature/generate',
      { method: 'POST', body: { method, path, body, timestamp, algorithm } },
    );
  }

  /** Check current IP throttle status. */
  async throttle(): Promise<{ ip: string; remaining: number; resetAt: number; limited: boolean }> {
    return this.http.request<{ ip: string; remaining: number; resetAt: number; limited: boolean }>(
      '/v1/shield/throttle',
    );
  }

  /** Shield health check. */
  async health(): Promise<{ shield: string; attestation: string; throttle: string; signature: string }> {
    return this.http.request<{ shield: string; attestation: string; throttle: string; signature: string }>(
      '/v1/shield/health',
    );
  }
}

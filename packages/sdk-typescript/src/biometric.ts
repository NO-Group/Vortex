import type { HttpClient } from './http.js';
import type { BiometricAttestation, BiometricChallenge, BiometricKind } from './types.js';

/**
 * Biometric authentication client — `/v1/auth/biometric`.
 */
export class Biometric {
  constructor(private readonly http: HttpClient) {}

  /** Issue a verification challenge. */
  async challenge(kind: BiometricKind = 'facial_liveness'): Promise<BiometricChallenge> {
    return this.http.request<BiometricChallenge>('/v1/auth/biometric/challenge', {
      method: 'POST',
      body: { kind },
    });
  }

  /** Verify a liveness-check payload against the challenge. */
  async verify(
    challengeId: string,
    kind: BiometricKind,
    payload: Record<string, unknown>,
  ): Promise<{ attestation: BiometricAttestation }> {
    return this.http.request<{ attestation: BiometricAttestation }>('/v1/auth/biometric/verify', {
      method: 'POST',
      body: { challengeId, kind, payload },
    });
  }

  /** List recent biometric attestations. */
  async listAttestations(): Promise<{ attestations: BiometricAttestation[] }> {
    return this.http.request<{ attestations: BiometricAttestation[] }>('/v1/auth/biometric/attestations');
  }

  /** Get a single attestation by id. */
  async getAttestation(id: string): Promise<{ attestation: BiometricAttestation }> {
    return this.http.request<{ attestation: BiometricAttestation }>(`/v1/auth/biometric/attestations/${id}`);
  }
}

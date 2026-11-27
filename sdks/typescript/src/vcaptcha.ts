import type { HttpClient } from './http.js';

export type VCaptchaMode = 'sequence' | 'negative' | 'pattern';

export interface VCaptchaChallenge {
  challengeId: string;
  mode: VCaptchaMode;
  gridSize: number;
  cellCount: number;
  sequenceLength: number;
  expiresAt: string;
  patternName?: string;
}

export interface VCaptchaSolution {
  challengeId: string;
  clicks: number[];
}

export interface VCaptchaVerifyResult {
  valid: boolean;
  message: string;
  newChallenge?: VCaptchaChallenge;
}

export interface VCaptchaConfig {
  id: string;
  enabled: boolean;
  default_mode: VCaptchaMode;
  default_grid_size: number;
  default_sequence_length: number;
  ttl_seconds: number;
  require_on_signup: boolean;
  require_on_login: boolean;
  max_attempts: number;
  updated_at: string;
}

export interface VCaptchaStats {
  total: number;
  solved: number;
  failed: number;
  expired: number;
  active: number;
}

export class VCaptcha {
  constructor(private readonly http: HttpClient) {}

  /**
   * Generate a new VCaptcha challenge.
   *
   * Returns the grid dimensions and metadata. The correct sequence
   * is stored server-side and never exposed to the client.
   *
   * The client should:
   * 1. Flash cells in random order on the grid (server has the answer)
   * 2. Let the user click cells to reproduce the sequence
   * 3. Call `verify()` with the clicked cell indices
   */
  async challenge(opts?: {
    mode?: VCaptchaMode;
    gridSize?: number;
    sequenceLength?: number;
  }): Promise<VCaptchaChallenge> {
    return this.http.request<VCaptchaChallenge>('/v1/vcaptcha/challenge', {
      method: 'POST',
      body: opts ?? {},
    });
  }

  /**
   * Verify a VCaptcha solution.
   *
   * Sends the challenge ID (HMAC hash) and the sequence of cell
   * indices the user clicked. Returns valid=true on success, or a
   * new challenge on failure.
   */
  async verify(solution: VCaptchaSolution): Promise<VCaptchaVerifyResult> {
    return this.http.request<VCaptchaVerifyResult>('/v1/vcaptcha/verify', {
      method: 'POST',
      body: solution,
    });
  }

  /** Get current VCaptcha configuration. */
  async getConfig(): Promise<VCaptchaConfig> {
    const resp = await this.http.request<{ config: VCaptchaConfig }>('/v1/vcaptcha/config');
    return resp.config;
  }

  /** Update VCaptcha configuration (admin only). */
  async updateConfig(patch: Partial<Omit<VCaptchaConfig, 'id' | 'updated_at'>>): Promise<VCaptchaConfig> {
    const resp = await this.http.request<{ config: VCaptchaConfig }>('/v1/vcaptcha/config', {
      method: 'PATCH',
      body: patch,
    });
    return resp.config;
  }

  /** Get challenge statistics (admin only). */
  async getStats(): Promise<VCaptchaStats> {
    const resp = await this.http.request<{ stats: VCaptchaStats }>('/v1/vcaptcha/stats');
    return resp.stats;
  }

  /** Delete expired challenges (admin only). */
  async cleanup(): Promise<{ deleted: number }> {
    return this.http.request<{ deleted: number }>('/v1/vcaptcha/cleanup', {
      method: 'POST',
    });
  }
}

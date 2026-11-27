/** VCaptcha — Temporal-Spatial Sequence Recall captcha. */

export type VCaptchaMode = 'sequence' | 'negative' | 'pattern';

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
  updated_at: Date;
}

/** Public challenge data returned to the client. Never contains the answer. */
export interface VCaptchaChallenge {
  challengeId: string;
  mode: VCaptchaMode;
  gridSize: number;
  cellCount: number;
  sequenceLength: number;
  expiresAt: string;
  /** For pattern mode: the shape name the user must reproduce. */
  patternName?: string;
}

/** Solution submitted by the client. */
export interface VCaptchaSolution {
  challengeId: string;
  clicks: number[];
}

export interface VCaptchaVerifyResult {
  valid: boolean;
  message: string;
  /** If invalid, a new challenge is recommended. */
  newChallenge?: VCaptchaChallenge;
}

export interface VCaptchaChallengeRow {
  id: string;
  challenge_hash: string;
  mode: VCaptchaMode;
  grid_size: number;
  sequence_length: number;
  sequence: number[];
  pattern_cells: number[] | null;
  negative: boolean;
  status: 'active' | 'solved' | 'failed' | 'expired';
  attempts: number;
  solved_by_ip: string | null;
  expires_at: Date;
  solved_at: Date | null;
  created_at: Date;
}

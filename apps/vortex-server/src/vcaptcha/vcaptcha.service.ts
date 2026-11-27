import crypto from 'node:crypto';
import type { Knex } from 'knex';
import type {
  VCaptchaConfig,
  VCaptchaChallenge,
  VCaptchaSolution,
  VCaptchaVerifyResult,
  VCaptchaMode,
} from './vcaptcha.types.js';

/** Pattern shapes for pattern mode. Each is a set of cell indices in an N×N grid. */
const PATTERNS: Record<string, (size: number) => number[]> = {
  cross: (s) => {
    const mid = Math.floor(s / 2);
    const cells: number[] = [];
    for (let i = 0; i < s; i++) { cells.push(mid * s + i); cells.push(i * s + mid); }
    return [...new Set(cells)];
  },
  diagonal: (s) => {
    const cells: number[] = [];
    for (let i = 0; i < s; i++) { cells.push(i * s + i); }
    return cells;
  },
  lshape: (s) => {
    const cells: number[] = [];
    for (let i = 0; i < s; i++) { cells.push(i * s); cells.push(0 * s + i); }
    return [...new Set(cells)];
  },
  corner: (s) => {
    const cells: number[] = [];
    for (let i = 0; i < Math.ceil(s / 2); i++) {
      for (let j = 0; j < Math.ceil(s / 2); j++) { cells.push(i * s + j); }
    }
    return cells;
  },
  border: (s) => {
    const cells: number[] = [];
    for (let i = 0; i < s; i++) {
      cells.push(0 * s + i);       // top row
      cells.push((s - 1) * s + i); // bottom row
      cells.push(i * s + 0);       // left col
      cells.push(i * s + (s - 1)); // right col
    }
    return [...new Set(cells)];
  },
};

const PATTERN_NAMES = Object.keys(PATTERNS);

/** Generate a random challenge hash signed with HMAC-SHA256. */
function signChallenge(id: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(id).digest('hex');
}

/** Verify a challenge hash against the stored ID. */
function verifyChallengeHash(id: string, hash: string, secret: string): boolean {
  const expected = signChallenge(id, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pick K unique random indices from a pool of N. */
function pickUnique<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < k && copy.length; i++) {
    const idx = crypto.randomInt(0, copy.length);
    const [picked] = copy.splice(idx, 1);
    if (picked !== undefined) result.push(picked);
  }
  return result;
}

export class VCaptchaService {
  constructor(
    private readonly db: Knex,
    private readonly secret: string,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────

  async getConfig(): Promise<VCaptchaConfig> {
    const row = await this.db('vcaptcha_config').where({ id: 'default' }).first();
    if (!row) {
      // Fallback to defaults if config row is missing
      return {
        id: 'default',
        enabled: false,
        default_mode: 'sequence',
        default_grid_size: 3,
        default_sequence_length: 3,
        ttl_seconds: 300,
        require_on_signup: false,
        require_on_login: false,
        max_attempts: 3,
        updated_at: new Date(),
      };
    }
    return row;
  }

  async updateConfig(patch: Partial<Omit<VCaptchaConfig, 'id' | 'updated_at'>>): Promise<VCaptchaConfig> {
    await this.db('vcaptcha_config')
      .where({ id: 'default' })
      .update({ ...patch, updated_at: this.db.fn.now() });
    return this.getConfig();
  }

  // ── Challenge Generation ────────────────────────────────────────────

  /**
   * Generate a new VCaptcha challenge.
   *
   * The correct sequence (or pattern cells) is stored server-side.
   * Only the grid dimensions and metadata are returned to the client.
   */
  async generateChallenge(opts?: {
    mode?: VCaptchaMode;
    gridSize?: number;
    sequenceLength?: number;
  }): Promise<VCaptchaChallenge> {
    const config = await this.getConfig();

    const mode = opts?.mode ?? config.default_mode;
    const gridSize = opts?.gridSize ?? config.default_grid_size;
    const sequenceLength = opts?.sequenceLength ?? config.default_sequence_length;

    // Clamp values to safe ranges
    const safeGrid = Math.max(3, Math.min(5, gridSize));
    const safeSeq = Math.max(3, Math.min(5, Math.min(sequenceLength, safeGrid * safeGrid)));

    const cellCount = safeGrid * safeGrid;
    const allCells = Array.from({ length: cellCount }, (_, i) => i);

    let sequence: number[];
    let patternCells: number[] | null = null;
    let patternName: string | undefined;
    let negative = false;

    if (mode === 'pattern') {
      const chosen = PATTERN_NAMES[crypto.randomInt(0, PATTERN_NAMES.length)]!;
      patternName = chosen;
      const cells = PATTERNS[chosen]!(safeGrid);
      patternCells = cells;
      sequence = [...cells].sort((a, b) => a - b);
    } else if (mode === 'negative') {
      sequence = pickUnique(allCells, safeSeq);
      negative = true;
    } else {
      // sequence mode (default)
      sequence = pickUnique(allCells, safeSeq);
    }

    const id = crypto.randomUUID();
    const hash = signChallenge(id, this.secret);
    const expiresAt = new Date(Date.now() + config.ttl_seconds * 1000);

    await this.db('vcaptcha_challenges').insert({
      id,
      challenge_hash: hash,
      mode,
      grid_size: safeGrid,
      sequence_length: safeSeq,
      sequence,
      pattern_cells: patternCells,
      negative,
      status: 'active',
      attempts: 0,
      expires_at: expiresAt,
    });

    return {
      challengeId: hash,
      mode,
      gridSize: safeGrid,
      cellCount,
      sequenceLength: safeSeq,
      expiresAt: expiresAt.toISOString(),
      patternName,
    };
  }

  // ── Verification ────────────────────────────────────────────────────

  /**
   * Verify a VCaptcha solution.
   *
   * Checks the challenge hash, expiry, attempt count, and the user's
   * click sequence against the stored answer.
   */
  async verifySolution(
    solution: VCaptchaSolution,
    ip?: string,
  ): Promise<VCaptchaVerifyResult> {
    const config = await this.getConfig();

    // Find the challenge by hash
    const challenge = await this.db('vcaptcha_challenges')
      .where({ challenge_hash: solution.challengeId, status: 'active' })
      .first();

    if (!challenge) {
      return { valid: false, message: 'Invalid or expired challenge. Please generate a new one.' };
    }

    // Verify HMAC integrity (defense in depth — the hash should match)
    if (!verifyChallengeHash(challenge.id, challenge.challenge_hash, this.secret)) {
      return { valid: false, message: 'Challenge integrity check failed.' };
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      await this.db('vcaptcha_challenges')
        .where({ id: challenge.id })
        .update({ status: 'expired' });
      return { valid: false, message: 'Challenge has expired. Please generate a new one.' };
    }

    // Check max attempts
    if (challenge.attempts >= config.max_attempts) {
      await this.db('vcaptcha_challenges')
        .where({ id: challenge.id })
        .update({ status: 'failed' });
      return { valid: false, message: 'Maximum attempts exceeded. Please generate a new challenge.' };
    }

    // Increment attempts
    await this.db('vcaptcha_challenges')
      .where({ id: challenge.id })
      .update({ attempts: challenge.attempts + 1 });

    // Normalize the user's clicks (sort for pattern mode, preserve order for sequence)
    const userClicks = [...solution.clicks].sort((a, b) => a - b);

    let valid = false;

    if (challenge.mode === 'sequence' || challenge.mode === 'negative') {
      if (challenge.negative) {
        // Negative mode: user must click EXACTLY the cells NOT in the sequence
        const shownSet = new Set(challenge.sequence);
        const expected = challenge.sequence_length === 0
          ? []
          : Array.from({ length: challenge.grid_size * challenge.grid_size }, (_, i) => i)
              .filter((i) => !shownSet.has(i));
        // For negative, the expected set is the complement
        const complement = Array.from({ length: challenge.grid_size * challenge.grid_size }, (_, i) => i)
          .filter((i) => !shownSet.has(i));
        valid = this.arraysEqual(userClicks, complement.sort((a, b) => a - b));
      } else {
        // Sequence mode: user must click in the EXACT order shown
        // The server stored the sequence in display order; compare as-is
        valid = this.arraysEqual(solution.clicks, challenge.sequence);
      }
    } else if (challenge.mode === 'pattern') {
      // Pattern mode: user must click exactly the pattern cells (order doesn't matter)
      const expected = [...(challenge.pattern_cells ?? [])].sort((a, b) => a - b);
      valid = this.arraysEqual(userClicks, expected);
    }

    if (valid) {
      await this.db('vcaptcha_challenges')
        .where({ id: challenge.id })
        .update({
          status: 'solved',
          solved_at: this.db.fn.now(),
          solved_by_ip: ip ?? null,
        });
      return { valid: true, message: 'Challenge verified successfully.' };
    }

    // Check if attempts are now exhausted
    const newAttempts = challenge.attempts + 1;
    if (newAttempts >= config.max_attempts) {
      await this.db('vcaptcha_challenges')
        .where({ id: challenge.id })
        .update({ status: 'failed' });
    }

    // Generate a new challenge to keep the user moving forward
    const newChallenge = await this.generateChallenge();
    return {
      valid: false,
      message: 'Incorrect sequence. Please try again with the new challenge.',
      newChallenge,
    };
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  /** Delete expired challenges. Call this periodically (e.g. via cron). */
  async cleanupExpired(): Promise<number> {
    const deleted = await this.db('vcaptcha_challenges')
      .where('expires_at', '<', this.db.fn.now())
      .del();
    return deleted;
  }

  // ── Stats ──────────────────────────────────────────────────────────

  async getStats(): Promise<{
    total: number;
    solved: number;
    failed: number;
    expired: number;
    active: number;
  }> {
    const total = await this.db('vcaptcha_challenges').count({ count: '*' }).first();
    const byStatus = await this.db('vcaptcha_challenges')
      .select('status')
      .count({ count: '*' })
      .groupBy('status');

    const statusMap: Record<string, number> = {};
    for (const row of byStatus as Array<{ status: string; count: string | number }>) {
      statusMap[row.status] = Number(row.count);
    }

    return {
      total: Number(total?.count ?? 0),
      solved: statusMap['solved'] ?? 0,
      failed: statusMap['failed'] ?? 0,
      expired: statusMap['expired'] ?? 0,
      active: statusMap['active'] ?? 0,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    // For sequence mode, order matters — compare as-is
    // For pattern/negative, we've already sorted both sides
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

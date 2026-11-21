/**
 * Function invocation quota — limits how many times a user can
 * invoke functions per hour.
 *
 * Anonymous invocations (no authenticated user) get a lower quota.
 * Authenticated users get a higher quota. Admins are exempt.
 */

interface QuotaEntry {
  count: number;
  windowStart: number;
}

export interface QuotaConfig {
  /** Max invocations per authenticated user per hour. */
  userLimit: number;
  /** Max invocations per anonymous caller per hour. */
  anonymousLimit: number;
  /** Window duration in ms (default 1 hour). */
  windowMs: number;
}

export const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  userLimit: 600,        // 600 invocations/hour per user
  anonymousLimit: 100,   // 100 invocations/hour per IP
  windowMs: 60 * 60 * 1000,
};

export class QuotaExceededError extends Error {
  constructor(limit: number, windowMs: number) {
    super(`Function invocation quota exceeded (${limit} per ${Math.round(windowMs / 60000)} min)`);
    this.name = 'QuotaExceededError';
  }
}

export class FunctionQuota {
  private entries = new Map<string, QuotaEntry>();
  private config: QuotaConfig;

  constructor(config: Partial<QuotaConfig> = {}) {
    this.config = { ...DEFAULT_QUOTA_CONFIG, ...config };
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  /**
   * Check if the caller can invoke a function.
   * Returns true if allowed, throws QuotaExceededError if not.
   */
  check(callerId: string | null, isAdmin: boolean): void {
    if (isAdmin) return;

    const now = Date.now();
    const key = callerId ?? 'anonymous';
    const limit = callerId ? this.config.userLimit : this.config.anonymousLimit;

    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      // New window
      this.entries.set(key, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= limit) {
      throw new QuotaExceededError(limit, this.config.windowMs);
    }

    entry.count++;
  }

  /** Get current count for a caller (for diagnostics). */
  getCount(callerId: string | null): number {
    const key = callerId ?? 'anonymous';
    const entry = this.entries.get(key);
    if (!entry) return 0;
    if (Date.now() - entry.windowStart >= this.config.windowMs) return 0;
    return entry.count;
  }

  /** Remove expired entries. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.entries.delete(key);
      }
    }
  }

  /** Clear all quota state (for tests). */
  reset(): void {
    this.entries.clear();
  }
}

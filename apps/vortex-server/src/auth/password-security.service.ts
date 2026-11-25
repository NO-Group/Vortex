import { createHash, timingSafeEqual } from 'node:crypto';
import type { Knex } from 'knex';
import { verifyPassword } from './passwords.js';
import { ApiError } from '../errors.js';

/**
 * Known breached password hashes (subset of real breached passwords).
 * In production, this would query the HIBP Pastebin API or a local
 * bloom filter. Here we include common breached passwords.
 */
const BREACHED_PASSWORDS = new Set([
  'password', '123456', '12345678', '1234', '12345', '123456789',
  'qwerty', 'abc123', 'password1', '111111', '123123', 'admin',
  'letmein', 'welcome', 'monkey', 'dragon', 'password123',
  '1234567890', '12345678910', 'football', 'iloveyou', 'admin123',
  'login', 'princess', 'qwertyuiop', 'passw0rd', 'trustno1',
  'sunshine', 'master', 'hello', 'freedom', 'whatever', 'qazwsx',
]);

interface LoginAttemptRow {
  id: string;
  email: string;
  failed_count: number;
  locked_until: Date | null;
  last_attempt_at: Date;
}

interface PasswordHistoryRow {
  id: string;
  user_id: string;
  password_hash: string;
  created_at: Date;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
  password_changed_at: Date | null;
}

export interface PasswordSecurityOptions {
  maxHistory?: number;       // max passwords to remember (default: 5)
  lockoutThreshold?: number; // failed attempts before lockout (default: 5)
  lockoutDurationMs?: number; // lockout duration (default: 15 min)
  breachedCheck?: boolean;   // check breached passwords (default: true)
}

/**
 * Password security — breached password detection, password history
 * (prevent reuse), and account lockout after failed attempts.
 */
export class PasswordSecurityService {
  private readonly maxHistory: number;
  private readonly lockoutThreshold: number;
  private readonly lockoutDurationMs: number;
  private readonly breachedCheck: boolean;

  constructor(
    private readonly db: Knex,
    opts?: PasswordSecurityOptions,
  ) {
    this.maxHistory = opts?.maxHistory ?? 5;
    this.lockoutThreshold = opts?.lockoutThreshold ?? 5;
    this.lockoutDurationMs = opts?.lockoutDurationMs ?? 15 * 60 * 1000;
    this.breachedCheck = opts?.breachedCheck ?? true;
  }

  /** Check if a password appears in known breached lists. */
  isBreached(password: string): boolean {
    // Check against known breached passwords
    if (BREACHED_PASSWORDS.has(password.toLowerCase())) return true;
    // Check against known breached hashes
    const hash = createHash('sha1').update(password.toLowerCase()).digest('hex');
    // SHA-1 of common breached passwords
    const commonBreached = new Set([
      createHash('sha1').update('password').digest('hex'),
      createHash('sha1').update('123456').digest('hex'),
      createHash('sha1').update('qwerty').digest('hex'),
      createHash('sha1').update('abc123').digest('hex'),
    ]);
    return commonBreached.has(hash);
  }

  /**
   * Verify login with password security checks:
   * 1. Check account is not locked
   * 2. Verify password
   * 3. On failure: increment counter, lock if threshold reached
   * 4. On success: reset counter, record password in history
   */
  async verifyLogin(
    userId: string,
    email: string,
    password: string,
    currentPasswordHash: string,
  ): Promise<{ success: boolean; locked: boolean; attemptsRemaining: number }> {
    // Check lockout
    const user = await this.db<UserRow>('users').where({ id: userId }).first();
    if (!user) return { success: false, locked: false, attemptsRemaining: 0 };

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      return { success: false, locked: true, attemptsRemaining: 0 };
    }

    // Verify password
    const valid = await verifyPassword(password, currentPasswordHash);

    if (valid) {
      // Reset failed counter
      await this.db('users').where({ id: userId }).update({
        failed_login_count: 0,
        locked_until: null,
      });
      // Clear login attempts
      await this.db('login_attempts').where({ email }).del();
      // Record password in history
      await this.recordPasswordHistory(userId, currentPasswordHash);
      return { success: true, locked: false, attemptsRemaining: this.lockoutThreshold };
    } else {
      // Increment failed counter
      const newCount = (user.failed_login_count ?? 0) + 1;
      const lockedUntil = newCount >= this.lockoutThreshold
        ? new Date(Date.now() + this.lockoutDurationMs)
        : null;
      const update: Record<string, unknown> = {
        failed_login_count: newCount,
      };
      if (lockedUntil) {
        update.locked_until = lockedUntil;
      }
      await this.db('users').where({ id: userId }).update(update);

      // Upsert login_attempts
      await this.db<LoginAttemptRow>('login_attempts')
        .insert({
          email,
          failed_count: newCount,
          locked_until: lockedUntil,
        })
        .onConflict('email')
        .merge({
          failed_count: newCount,
          locked_until: lockedUntil,
          last_attempt_at: new Date(),
        });

      const locked = newCount >= this.lockoutThreshold;
      return {
        success: false,
        locked,
        attemptsRemaining: Math.max(0, this.lockoutThreshold - newCount),
      };
    }
  }

  /**
   * Check if a new password is acceptable:
   * 1. Not breached
   * 2. Not in password history
   * 3. Meets minimum requirements
   */
  async validateNewPassword(
    userId: string,
    newPassword: string,
    currentPasswordHash: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Minimum requirements
    if (newPassword.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (newPassword.length > 128) {
      errors.push('Password must be at most 128 characters');
    }

    // Breached check
    if (this.breachedCheck && this.isBreached(newPassword)) {
      errors.push('Password appears in a known breached list');
    }

    // Password history check
    const history = await this.db<PasswordHistoryRow>('password_history')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(this.maxHistory);

    for (const row of history) {
      const matches = await verifyPassword(newPassword, row.password_hash);
      if (matches) {
        errors.push(`Password was used previously (must be different from last ${this.maxHistory} passwords)`);
        break;
      }
    }

    // Check against current password
    const currentMatches = await verifyPassword(newPassword, currentPasswordHash);
    if (currentMatches) {
      errors.push('New password must be different from current password');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Record a password hash in history (for change password). */
  async recordPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    await this.db<PasswordHistoryRow>('password_history')
      .insert({ user_id: userId, password_hash: passwordHash });

    // Trim to maxHistory
    const rows = await this.db<PasswordHistoryRow>('password_history')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(this.maxHistory + 1);

    if (rows.length > this.maxHistory) {
      for (const row of rows.slice(this.maxHistory)) {
        await this.db('password_history').where({ id: row.id }).del();
      }
    }
  }

  /** Get password history for a user. */
  async getHistory(userId: string): Promise<PasswordHistoryRow[]> {
    return this.db<PasswordHistoryRow>('password_history')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(this.maxHistory);
  }

  /** Get lockout status for a user. */
  async getLockoutStatus(userId: string): Promise<{
    locked: boolean;
    lockedUntil: string | null;
    failedCount: number;
    attemptsRemaining: number;
  }> {
    const user = await this.db<UserRow>('users').where({ id: userId }).first();
    if (!user) return { locked: false, lockedUntil: null, failedCount: 0, attemptsRemaining: this.lockoutThreshold };

    const locked = !!user.locked_until && user.locked_until.getTime() > Date.now();
    const failedCount = user.failed_login_count ?? 0;

    return {
      locked,
      lockedUntil: user.locked_until?.toISOString() ?? null,
      failedCount,
      attemptsRemaining: Math.max(0, this.lockoutThreshold - failedCount),
    };
  }

  /** Clear lockout for a user (admin override). */
  async clearLockout(userId: string): Promise<void> {
    await this.db('users').where({ id: userId }).update({
      failed_login_count: 0,
      locked_until: null,
    });
    await this.db('login_attempts').del();
  }
}

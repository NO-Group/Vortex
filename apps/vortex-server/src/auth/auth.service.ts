import type { Knex } from 'knex';
import type { AuthSession, AuthUser, LoginInput, SignupInput } from '@vortex/core';
import { ApiError } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signToken, type TokenConfig } from './tokens.js';
import { OneTimeTokens } from './one-time-tokens.js';
import { authLink, magicLinkEmail, passwordResetEmail } from '../mailer/mailer.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

function sessionFor(row: UserRow, config: TokenConfig): AuthSession {
  const token = signToken(
    {
      userId: row.id,
      email: row.email,
      role: row.role,
      meta: row.metadata ?? {},
    },
    config,
  );
  return {
    user: toAuthUser(row),
    token,
    expiresIn: 3600,
  };
}

export interface MagicLinkResult {
  ok: true;
  /** Present only in dev-links mode — lets demos proceed without SMTP. */
  devToken?: string;
  /** How the link was (or wasn't) delivered. */
  delivery?: 'email' | 'inline' | 'unconfigured';
}

export interface AuthServiceOptions {
  devLinks?: boolean;
  publicAppUrl?: string;
  mailer?: { send(to: string, subject: string, html: string): Promise<void> } | null;
}

export class AuthService {
  private readonly oneTime: OneTimeTokens;

  constructor(
    private readonly db: Knex,
    private readonly tokenConfig: TokenConfig,
    private readonly opts: AuthServiceOptions = {},
  ) {
    this.oneTime = new OneTimeTokens(db);
  }

  /** Issue a one-time token and deliver it by email and/or inline. */
  private async issueAndDeliver(
    userId: string,
    email: string,
    kind: 'magic' | 'reset',
    ttlMinutes: number,
  ): Promise<MagicLinkResult> {
    const { token } = await this.oneTime.issue(userId, kind, ttlMinutes);
    const url = authLink(this.opts.publicAppUrl ?? 'http://localhost:8080', token);

    let delivery: MagicLinkResult['delivery'] = 'unconfigured';
    if (this.opts.mailer) {
      try {
        const template = kind === 'magic' ? magicLinkEmail(url) : passwordResetEmail(url);
        await this.opts.mailer.send(email, template.subject, template.html);
        delivery = 'email';
      } catch (err) {
        console.warn(`[vortex] email delivery failed: ${(err as Error).message}`);
      }
    }
    if (this.opts.devLinks) {
      delivery = delivery === 'email' ? 'email' : 'inline';
      return { ok: true, devToken: token, delivery };
    }
    return { ok: true, delivery };
  }

  /** Register a new user and return an authenticated session. */
  async signup(input: SignupInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db<UserRow>('users').where({ email }).first();
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const [row] = await this.db<UserRow>('users')
      .insert({
        email,
        password_hash: passwordHash,
        role: 'user',
        metadata: input.metadata ?? {},
      })
      .returning('*');

    if (!row) throw ApiError.conflict('Could not create account');
    return sessionFor(row, this.tokenConfig);
  }

  /** Authenticate with email + password. */
  async login(input: LoginInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const row = await this.db<UserRow>('users').where({ email }).first();

    // Constant-shape failure path: same error whether the user is missing
    // or the password is wrong.
    if (!row) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    const ok = await verifyPassword(input.password, row.password_hash);
    if (!ok) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    return sessionFor(row, this.tokenConfig);
  }

  /** Fetch the profile for an authenticated user id. */
  async me(userId: string): Promise<AuthUser> {
    const row = await this.db<UserRow>('users').where({ id: userId }).first();
    if (!row) throw ApiError.notFound('User not found');
    return toAuthUser(row);
  }

  /**
   * Start passwordless sign-in: email a one-time link (or return the token
   * in dev-links mode). Always succeeds from the caller's perspective —
   * unknown emails get the same 202 (no account enumeration).
   */
  async requestMagicLink(email: string): Promise<MagicLinkResult> {
    const normalized = email.trim().toLowerCase();
    const row = await this.db<UserRow>('users').where({ email: normalized }).first();
    if (!row) return { ok: true, delivery: 'unconfigured' };
    return this.issueAndDeliver(row.id, normalized, 'magic', 15);
  }

  /** Consume a magic-link token and open a session. */
  async verifyMagicLink(token: string): Promise<AuthSession> {
    const userId = await this.oneTime.consume(token, 'magic');
    if (!userId) throw ApiError.unauthorized('Sign-in link is invalid, used, or expired');
    const row = await this.db<UserRow>('users').where({ id: userId }).first();
    if (!row) throw ApiError.unauthorized('Sign-in link is invalid, used, or expired');
    return sessionFor(row, this.tokenConfig);
  }

  /** Start a password reset (same no-enumeration shape as magic links). */
  async requestPasswordReset(email: string): Promise<MagicLinkResult> {
    const normalized = email.trim().toLowerCase();
    const row = await this.db<UserRow>('users').where({ email: normalized }).first();
    if (!row) return { ok: true, delivery: 'unconfigured' };
    return this.issueAndDeliver(row.id, normalized, 'reset', 30);
  }

  /** Consume a reset token, set a new password, and open a session. */
  async confirmPasswordReset(token: string, password: string): Promise<AuthSession> {
    const userId = await this.oneTime.consume(token, 'reset');
    if (!userId) throw ApiError.unauthorized('Reset token is invalid, used, or expired');

    const passwordHash = await hashPassword(password);
    const [row] = await this.db<UserRow>('users')
      .where({ id: userId })
      .update({ password_hash: passwordHash })
      .returning('*');
    if (!row) throw ApiError.unauthorized('Reset token is invalid, used, or expired');
    return sessionFor(row, this.tokenConfig);
  }

  /** Admin: list all accounts. */
  async listUsers(): Promise<AuthUser[]> {
    const rows = await this.db<UserRow>('users').orderBy('created_at', 'asc');
    return rows.map(toAuthUser);
  }

  /** Admin: change a user's role and/or custom claims (metadata). */
  async updateUser(
    targetId: string,
    patch: { role?: string; metadata?: Record<string, unknown> },
  ): Promise<AuthUser> {
    const updates: Record<string, unknown> = {};
    if (patch.role !== undefined) {
      if (!/^[a-z][a-z0-9_-]{0,30}$/.test(patch.role)) {
        throw ApiError.badRequest('Role must be lowercase letters, digits, dashes, underscores');
      }
      updates.role = patch.role;
    }
    if (patch.metadata !== undefined) {
      updates.metadata = patch.metadata;
    }
    if (!Object.keys(updates).length) {
      throw ApiError.badRequest('Nothing to update (send role and/or metadata)');
    }

    const [row] = await this.db<UserRow>('users')
      .where({ id: targetId })
      .update(updates)
      .returning('*');
    if (!row) throw ApiError.notFound('User not found');
    return toAuthUser(row);
  }

  /** Admin: delete an account (refuses self-deletion). */
  async deleteUser(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }
    const deleted = await this.db('users').where({ id: targetId }).del();
    if (!deleted) throw ApiError.notFound('User not found');
  }

  /** User: update own profile metadata. */
  async updateProfile(
    userId: string,
    patch: { metadata?: Record<string, unknown> },
  ): Promise<AuthUser> {
    if (!patch.metadata || !Object.keys(patch.metadata).length) {
      throw ApiError.badRequest('Nothing to update (send metadata)');
    }
    const [row] = await this.db<UserRow>('users')
      .where({ id: userId })
      .update({ metadata: patch.metadata })
      .returning('*');
    if (!row) throw ApiError.notFound('User not found');
    return toAuthUser(row);
  }

  /** User: change password after verifying current password. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthSession> {
    const row = await this.db<UserRow>('users').where({ id: userId }).first();
    if (!row) throw ApiError.notFound('User not found');
    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) throw ApiError.unauthorized('Current password is incorrect');
    const newHash = await hashPassword(newPassword);
    const [updated] = await this.db<UserRow>('users')
      .where({ id: userId })
      .update({ password_hash: newHash })
      .returning('*');
    if (!updated) throw ApiError.notFound('User not found');
    return sessionFor(updated, this.tokenConfig);
  }

  /** User: delete own account. */
  async deleteAccount(userId: string): Promise<void> {
    const deleted = await this.db('users').where({ id: userId }).del();
    if (!deleted) throw ApiError.notFound('User not found');
  }
}

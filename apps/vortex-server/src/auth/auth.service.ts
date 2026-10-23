import type { Knex } from 'knex';
import type { AuthSession, AuthUser, LoginInput, SignupInput } from '@vortex/core';
import { ApiError } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signToken, type TokenConfig } from './tokens.js';

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
  const token = signToken({ userId: row.id, email: row.email, role: row.role }, config);
  return {
    user: toAuthUser(row),
    token,
    expiresIn: 3600,
  };
}

export class AuthService {
  constructor(
    private readonly db: Knex,
    private readonly tokenConfig: TokenConfig,
  ) {}

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
}

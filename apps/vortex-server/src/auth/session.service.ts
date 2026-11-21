/**
 * Vortex Server — Session/Auth service: user management, signup, login.
 */

import type { Knex } from 'knex';
import { generateTokens, hashPassword, verifyPassword, normalizeRole, type User, type AuthTokens, type UserRole, type JwtConfig } from '@vortex/core';
import { ApiError } from '../errors.js';

export class SessionService {
  constructor(
    private db: Knex,
    private jwtConfig: JwtConfig,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db('users').where({ email }).first<Record<string, unknown>>();
    if (!row) return null;
    return this.toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db('users').where({ id }).first<Record<string, unknown>>();
    if (!row) return null;
    return this.toUser(row);
  }

  async createUser(opts: { email: string; password: string; name: string; role?: string }): Promise<User> {
    const existing = await this.findByEmail(opts.email);
    if (existing) {
      throw ApiError.conflict('A user with this email already exists');
    }

    const passwordHash = await hashPassword(opts.password);
    const [id] = await this.db('users')
      .insert({
        email: opts.email,
        name: opts.name,
        password_hash: passwordHash,
        role: normalizeRole(opts.role),
      })
      .returning('id');

    const user = await this.findById(id as string);
    if (!user) throw ApiError.internal('Failed to create user');
    return user;
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const row = await this.db('users').where({ email }).first<Record<string, unknown>>();
    if (!row || !row.password_hash) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await verifyPassword(password, row.password_hash as string);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const user = this.toUser(row);
    return { user, tokens: generateTokens(user, this.jwtConfig) };
  }

  private toUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      role: (row.role as UserRole) ?? 'developer',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

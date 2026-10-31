import type { Knex } from 'knex';

/**
 * Migration: session management, password security (history + lockout),
 * signed webhooks, encryption at rest, and security scoring.
 */
export async function up(knex: Knex): Promise<void> {
  // ── Session management ────────────────────────────────────────────────
  // Tracks active sessions per user so they can list/revoke them.
  await knex.schema.createTable('user_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('session_id').notNullable(); // JWT jti
    t.text('user_agent').nullable();
    t.text('ip_address').nullable();
    t.text('device_type').nullable(); // web / mobile / desktop
    t.timestamp('last_active_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.boolean('revoked').notNullable().defaultTo(false);
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.index(['user_id']);
    t.index(['session_id']);
    t.index(['revoked']);
  });

  // ── Password history ─────────────────────────────────────────────────
  // Stores hashes of previous passwords to prevent reuse.
  await knex.schema.createTable('password_history', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('password_hash').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  // ── Failed login attempts / account lockout ──────────────────────────
  await knex.schema.createTable('login_attempts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('email').notNullable(); // normalized email
    t.integer('failed_count').notNullable().defaultTo(0);
    t.timestamp('locked_until', { useTz: true }).nullable();
    t.timestamp('last_attempt_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['email']);
  });

  // ── Signed webhooks ──────────────────────────────────────────────────
  // Stores HMAC signatures for webhook deliveries.
  await knex.schema.createTable('webhook_signatures', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('webhook_id').nullable();
    t.text('event').notNullable();
    t.text('signature').notNullable(); // HMAC-SHA256 hex
    t.text('payload_hash').notNullable(); // SHA-256 of payload
    t.boolean('verified').notNullable().defaultTo(false);
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['webhook_id']);
    t.index(['event']);
  });

  // ── Encryption at rest ───────────────────────────────────────────────
  // Metadata for encrypted fields (which fields are encrypted, key version).
  await knex.schema.createTable('encryption_keys', (t) => {
    t.text('key_id').primary();
    t.text('algorithm').notNullable().defaultTo('aes-256-gcm');
    t.text('key_version').notNullable();
    t.jsonb('key_ref').notNullable(); // { env: 'ENCRYPTION_KEY' } or { file: '...' }
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Security scoring ─────────────────────────────────────────────────
  // Stores periodic security posture snapshots.
  await knex.schema.createTable('security_scores', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').nullable();
    t.integer('score').notNullable(); // 0-100
    t.text('grade').notNullable(); // A+, A, B, C, D, F
    t.jsonb('checks').notNullable(); // { twoFactorEnabled: true, ... }
    t.text('recommendations').nullable(); // JSON array of strings
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  // ── Add columns to existing tables ────────────────────────────────────
  await knex.schema.alterTable('users', (t) => {
    t.text('password_changed_at').nullable();
    t.integer('failed_login_count').nullable().defaultTo(0);
    t.timestamp('locked_until', { useTz: true }).nullable();
  });

  await knex.schema.alterTable('vortex_webhooks', (t) => {
    t.text('signing_secret').nullable(); // HMAC secret for signing
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('password_changed_at');
    t.dropColumn('failed_login_count');
    t.dropColumn('locked_until');
  });
  await knex.schema.alterTable('vortex_webhooks', (t) => {
    t.dropColumn('signing_secret');
  });
  await knex.schema.dropTable('security_scores');
  await knex.schema.dropTable('encryption_keys');
  await knex.schema.dropTable('webhook_signatures');
  await knex.schema.dropTable('login_attempts');
  await knex.schema.dropTable('password_history');
  await knex.schema.dropTable('user_sessions');
}

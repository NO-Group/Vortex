import type { Knex } from 'knex';

/**
 * Migration: auth QR codes, biometric attestations, shield/AppCheck,
 * chunked uploads, and media transformations.
 */
export async function up(knex: Knex): Promise<void> {
  // ── QR Code sign-in tokens ────────────────────────────────────────────
  // One-time tokens for QR-code-based sign-in (scan → verify → session).
  // Reuses the auth_tokens table pattern but with kind 'qr'.
  await knex.schema.alterTable('auth_tokens', (t) => {
    t.text('qr_payload').nullable(); // optional QR-encoded payload
  });

  // ── Biometric attestations ────────────────────────────────────────────
  // Stores Face ID / Touch ID liveness-check results for audit.
  await knex.schema.createTable('biometric_attestations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('kind').notNullable().defaultTo('facial_liveness'); // facial_liveness | fingerprint
    t.jsonb('payload').notNullable(); // raw liveness-check payload
    t.boolean('verified').notNullable().defaultTo(false);
    t.text('liveness_score').nullable(); // 0.0 – 1.0 confidence
    t.text('challenge_id').nullable(); // server-issued challenge
    t.timestamp('verified_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['challenge_id']);
  });

  // ── Shield / AppCheck ─────────────────────────────────────────────────
  // Client attestation records (AppCheck-style) + IP throttle counters.
  await knex.schema.createTable('shield_attestations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').nullable(); // null for anonymous
    t.text('attestation_type').notNullable(); // app_check | play_integrity | safety_net
    t.jsonb('payload').notNullable(); // attestation response
    t.boolean('valid').notNullable().defaultTo(false);
    t.text('revision').nullable();
    t.timestamp('expires_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['attestation_type']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('shield_throttle', (t) => {
    t.text('ip').primary();
    t.integer('request_count').notNullable().defaultTo(0);
    t.integer('window_start').notNullable(); // epoch ms
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Chunked uploads ──────────────────────────────────────────────────
  // Tracks multipart/chunked upload sessions.
  await knex.schema.createTable('chunked_uploads', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('upload_id').notNullable().unique(); // S3 multipart upload id or local session id
    t.text('owner_id').notNullable();
    t.text('key').notNullable();
    t.text('content_type').nullable();
    t.integer('total_chunks').notNullable();
    t.integer('chunks_received').notNullable().defaultTo(0);
    t.jsonb('chunk_hashes').nullable(); // { 1: "sha256...", 2: "..." }
    t.text('driver').notNullable().defaultTo('local'); // local | s3
    t.text('status').notNullable().defaultTo('in_progress'); // in_progress | completed | aborted
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['owner_id']);
    t.index(['key']);
  });

  // ── Media transformations ────────────────────────────────────────────
  // Records requested image/video transformations and their webhook status.
  await knex.schema.createTable('media_transformations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('key').notNullable();
    t.text('operation').notNullable(); // resize | crop | format | quality | rotate
    t.jsonb('params').notNullable(); // { width: 800, height: 600, quality: 80 }
    t.text('output_key').notNullable(); // transformed object key
    t.text('owner_id').notNullable();
    t.text('status').notNullable().defaultTo('pending'); // pending | processing | completed | failed
    t.text('webhook_status').nullable(); // sent | failed | skipped
    t.text('error_message').nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['owner_id']);
    t.index(['key']);
    t.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('media_transformations');
  await knex.schema.dropTable('chunked_uploads');
  await knex.schema.dropTable('shield_throttle');
  await knex.schema.dropTable('shield_attestations');
  await knex.schema.dropTable('biometric_attestations');
  await knex.schema.alterTable('auth_tokens', (t) => {
    t.dropColumn('qr_payload');
  });
}

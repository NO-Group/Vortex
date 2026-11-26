import type { Knex } from 'knex';

/**
 * Migration: VCaptcha — Temporal-Spatial Sequence Recall captcha.
 *
 * Stores challenges and verification results. Challenges are short-lived
 * (5 min TTL) and single-use. The challenge payload (grid + correct
 * sequence) is stored server-side; only the public-facing grid dimensions
 * and cell count are returned to the client.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vcaptcha_challenges', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('challenge_hash').notNullable(); // HMAC-signed challenge ID for integrity
    t.text('mode').notNullable().defaultTo('sequence'); // sequence | negative | pattern
    t.integer('grid_size').notNullable(); // 3, 4, or 5 (NxN grid)
    t.integer('sequence_length').notNullable(); // 3-5 cells
    t.jsonb('sequence').notNullable(); // ordered array of cell indices [0, 4, 2, ...]
    t.jsonb('pattern_cells').nullable(); // for pattern mode: shape cells
    t.boolean('negative').notNullable().defaultTo(false); // negative mode: click what was NOT shown
    t.text('status').notNullable().defaultTo('active'); // active | solved | failed | expired
    t.integer('attempts').notNullable().defaultTo(0);
    t.text('solved_by_ip').nullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('solved_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['challenge_hash']);
    t.index(['status']);
    t.index(['expires_at']);
  });

  // VCaptcha configuration — one row, updated by admin
  await knex.schema.createTable('vcaptcha_config', (t) => {
    t.text('id').primary().defaultTo('default');
    t.boolean('enabled').notNullable().defaultTo(false);
    t.text('default_mode').notNullable().defaultTo('sequence'); // sequence | negative | pattern
    t.integer('default_grid_size').notNullable().defaultTo(3);
    t.integer('default_sequence_length').notNullable().defaultTo(3);
    t.integer('ttl_seconds').notNullable().defaultTo(300);
    t.boolean('require_on_signup').notNullable().defaultTo(false);
    t.boolean('require_on_login').notNullable().defaultTo(false);
    t.integer('max_attempts').notNullable().defaultTo(3);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Seed default config
  await knex.insert({
    id: 'default',
    enabled: false,
    default_mode: 'sequence',
    default_grid_size: 3,
    default_sequence_length: 3,
    ttl_seconds: 300,
    require_on_signup: false,
    require_on_login: false,
    max_attempts: 3,
  }).into('vcaptcha_config');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vcaptcha_config');
  await knex.schema.dropTable('vcaptcha_challenges');
}

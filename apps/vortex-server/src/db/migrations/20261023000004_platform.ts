import type { Knex } from 'knex';

/**
 * v0.6 Platform tables:
 *  - auth_tokens — one-time magic-link / password-reset tokens (hashed)
 *  - buckets    — storage namespaces (`<bucket>/<key>`), public or private
 *  - functions  — Vortex Functions registry (source runs in the engine)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('auth_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('kind', 16).notNullable(); // 'magic' | 'reset'
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('used_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'kind']);
  });

  await knex.schema.createTable('buckets', (t) => {
    t.string('name', 64).primary();
    t.boolean('public').notNullable().defaultTo(false);
    t.uuid('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('functions', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 48).notNullable().unique();
    t.string('title', 120).notNullable();
    t.text('source').notNullable();
    t.string('status', 16).notNullable().defaultTo('active'); // 'active' | 'paused'
    t.uuid('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['owner_id']);
  });

  // Default buckets: private `uploads`, public `public` (apps/ is engine-owned).
  await knex('buckets').insert([
    { name: 'uploads', public: false, owner_id: null },
    { name: 'public', public: true, owner_id: null },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('functions');
  await knex.schema.dropTableIfExists('buckets');
  await knex.schema.dropTableIfExists('auth_tokens');
}

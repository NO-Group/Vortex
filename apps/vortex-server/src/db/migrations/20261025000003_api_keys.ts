import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_api_keys', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('name').notNullable();
    t.text('key_prefix').notNullable(); // first 12 chars for identification
    t.text('key_hash').notNullable();    // SHA-256 of the full key
    t.jsonb('scopes').nullable();        // e.g. ["database:read", "storage:write"]
    t.timestamp('last_used_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.index(['user_id']);
    t.index(['key_prefix']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_api_keys');
}

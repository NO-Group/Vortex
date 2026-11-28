import type { Knex } from 'knex';

/**
 * Phase 4.5: OIDC Refresh Token storage.
 *
 *  - vortex_oauth_refresh_tokens — persisted refresh tokens so the
 *    refresh_token grant can validate and rotate them.
 *
 * Without this table, issued refresh tokens were never persisted and
 * could not be validated — the refresh_token grant_type was a stub.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_oauth_refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.text('token_hash').notNullable().unique();      // SHA-256 hash of the raw token
    t.string('client_id', 64).notNullable();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('scope', 256).notNullable().defaultTo('');
    t.string('previous_token_hash', 256).nullable();   // rotation chain
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['client_id']);
    t.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_oauth_refresh_tokens');
}

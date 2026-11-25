import type { Knex } from 'knex';

/**
 * v0.8 OAuth provider tables:
 *  - vortex_oauth_providers  — admin-configured OAuth app credentials
 *  - vortex_oauth_accounts  — linked accounts (Vortex user ↔ provider identity)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_oauth_providers', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 32).notNullable().unique(); // 'google', 'github', 'gitlab', 'discord', 'apple', 'microsoft'
    t.string('display_name', 64).notNullable();   // 'Google'
    t.string('client_id', 256).notNullable();
    t.text('client_secret').notNullable();
    t.string('auth_url', 512).notNullable();
    t.string('token_url', 512).notNullable();
    t.string('userinfo_url', 512).notNullable();
    t.string('scopes', 256).notNullable().defaultTo('openid profile email');
    t.jsonb('extra').nullable(); // provider-specific config (e.g. Apple key_id)
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('vortex_oauth_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('provider', 32).notNullable();
    t.string('provider_user_id', 256).notNullable();
    t.string('provider_email', 256).nullable();
    t.jsonb('profile').nullable(); // full provider profile JSON
    t.timestamp('linked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['provider', 'provider_user_id']);
    t.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_oauth_accounts');
  await knex.schema.dropTableIfExists('vortex_oauth_providers');
}

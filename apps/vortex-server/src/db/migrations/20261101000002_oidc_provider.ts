import type { Knex } from 'knex';

/**
 * Phase 4.4: OIDC / SSO Identity Server tables.
 *
 *  - vortex_oauth_clients  — registered OAuth/OIDC clients (external apps)
 *  - vortex_oauth_auth_codes — short-lived authorization codes
 *  - vortex_oidc_keys      — RSA key pair for signing ID tokens (JWKS)
 */
export async function up(knex: Knex): Promise<void> {
  // ── OAuth/OIDC Clients ─────────────────────────────────────────────────
  await knex.schema.createTable('vortex_oauth_clients', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('client_id', 64).notNullable().unique();
    t.text('client_secret_hash').notNullable();
    t.string('name', 128).notNullable();          // Display name
    t.string('description', 256).nullable();
    t.text('redirect_uris').notNullable();         // Comma-separated or JSON array
    t.string('scopes', 256).notNullable().defaultTo('openid profile email');
    t.string('grant_types', 128).notNullable().defaultTo('authorization_code refresh_token');
    t.string('logo_url', 512).nullable();
    t.string('website_url', 512).nullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.uuid('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['app_id']);
    t.index(['owner_id']);
  });

  // ── Authorization Codes ────────────────────────────────────────────────
  await knex.schema.createTable('vortex_oauth_auth_codes', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.text('code').notNullable().unique();
    t.string('client_id', 64).notNullable();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('redirect_uri', 512).notNullable();
    t.string('scope', 256).notNullable();
    t.string('code_challenge', 128).nullable();     // PKCE
    t.string('code_challenge_method', 16).nullable(); // S256 | plain
    t.string('nonce', 128).nullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('used_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['client_id']);
    t.index(['user_id']);
  });

  // ── OIDC Key Pair (JWKS) ──────────────────────────────────────────────
  await knex.schema.createTable('vortex_oidc_keys', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('kid', 64).notNullable().unique();       // Key ID
    t.text('private_key').notNullable();              // PEM-encoded RSA private key
    t.text('public_key').notNullable();               // PEM-encoded RSA public key
    t.string('alg', 32).notNullable().defaultTo('RS256');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('expires_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_oidc_keys');
  await knex.schema.dropTableIfExists('vortex_oauth_auth_codes');
  await knex.schema.dropTableIfExists('vortex_oauth_clients');
}

import type { Knex } from 'knex';

/**
 * Migration: add OIDC discovery URL column to OAuth providers.
 *
 * Enables the generic OIDC provider flow — users paste a discovery URL
 * (e.g. `https://idp.example.com/.well-known/openid-configuration`) and
 * Vortex auto-discovers all endpoints.
 *
 * Google OAuth is seeded from environment variables so credentials never
 * live in source control:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('vortex_oauth_providers', (t) => {
    t.text('discovery_url').nullable();
  });

  // ── Seed Google OAuth provider from env vars ──────────────────────────
  // Pre-configured so Google sign-in works out of the box when the
  // operator provides credentials in .env. Skips seeding if not set.
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    await knex('vortex_oauth_providers')
      .insert({
        name: 'google',
        display_name: 'Google',
        client_id: googleClientId,
        client_secret: googleClientSecret,
        auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        userinfo_url: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scopes: 'openid profile email',
        extra: null,
        enabled: true,
        discovery_url: 'https://accounts.google.com/.well-known/openid-configuration',
      })
      .onConflict(['name'])
      .ignore();
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('vortex_oauth_providers', (t) => {
    t.dropColumn('discovery_url');
  });
}

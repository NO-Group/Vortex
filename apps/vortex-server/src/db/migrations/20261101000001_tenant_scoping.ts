import type { Knex } from 'knex';

/**
 * Multi-Tenant App Scoping — Phase 4.1 Migration
 *
 * Adds `app_id` columns to tables that should be scoped per-app.
 * The app_id is nullable for backward compatibility with existing rows
 * (single-tenant deployments). When set, the QueryService auto-appends
 * `AND app_id = $app_bound` to queries on these tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Add app_id to storage_objects (objects uploaded by apps)
  await knex.schema.alterTable('storage_objects', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Add app_id to chunked_uploads (in-progress uploads)
  await knex.schema.alterTable('chunked_uploads', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Add app_id to vortex_api_keys (API keys issued per-app)
  await knex.schema.alterTable('vortex_api_keys', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Add app_id to vortex_webhooks (webhook subscriptions per-app)
  await knex.schema.alterTable('vortex_webhooks', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Add app_id to functions (serverless functions per-app)
  await knex.schema.alterTable('functions', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Add app_id to vortex_custom_domains (domains registered per-app)
  await knex.schema.alterTable('vortex_custom_domains', (t) => {
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.index(['app_id']);
  });

  // Set app_id on existing rows where possible (from owner_id → apps mapping)
  // This is a no-op for new installations; existing data keeps app_id = null
  // and continues to work via owner_id scoping.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('functions', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });

  await knex.schema.alterTable('vortex_webhooks', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });

  await knex.schema.alterTable('vortex_api_keys', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });

  await knex.schema.alterTable('chunked_uploads', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });

  await knex.schema.alterTable('storage_objects', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });

  await knex.schema.alterTable('vortex_custom_domains', (t) => {
    t.dropColumn('app_id');
    t.dropIndex(['app_id']);
  });
}

import type { Knex } from 'knex';

/**
 * Creates the storage_objects table for tracking file metadata.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('storage_objects', (table) => {
    table.string('key', 1024).primary();
    table.bigint('size').notNullable().defaultTo(0);
    table.string('content_type', 255).notNullable();
    table.string('owner_id', 36).nullable();
    table.string('app_id', 36).nullable();
    table.string('etag', 128).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['owner_id'], 'idx_storage_owner');
    table.index(['app_id'], 'idx_storage_app');
    table.index(['created_at'], 'idx_storage_created');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('storage_objects');
}

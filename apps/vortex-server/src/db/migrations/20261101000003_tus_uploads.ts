import type { Knex } from 'knex';

/**
 * Phase 4.2: TUS Protocol Adapter — resumable upload table.
 *
 *  - vortex_tus_uploads — TUS upload sessions with byte-offset tracking
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_tus_uploads', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.text('upload_id').notNullable().unique();    // TUS upload identifier
    t.uuid('owner_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('key').notNullable();                    // Storage key
    t.bigint('size').notNullable();                 // Declared total size
    t.bigint('offset').notNullable().defaultTo(0);  // Current byte offset
    t.text('content_type').nullable();
    t.jsonb('metadata').nullable();                 // Upload-Metadata header values
    t.text('checksum').nullable();                  // Upload-Checksum (if provided)
    t.timestamp('expires_at', { useTz: true }).nullable();
    t.text('status').notNullable().defaultTo('in_progress'); // in_progress | completed | terminated
    t.uuid('app_id').nullable().references('id').inTable('apps').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.index(['owner_id']);
    t.index(['app_id']);
    t.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_tus_uploads');
}

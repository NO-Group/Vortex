import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── Full-text search index registry ───────────────────────────────────
  // Tracks PostgreSQL GIN full-text indexes created on user tables.
  // Each row records which table + columns are indexed, the language
  // configuration, and the physical index name so we can drop it later.
  await knex.schema.createTable('vortex_fulltext_indexes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('table_name').notNullable();        // target table (validated identifier)
    t.text('name').notNullable();              // logical index name (slug)
    t.jsonb('columns').notNullable();          // ["title", "body"] — columns to concatenate
    t.text('language').notNullable().defaultTo('english'); // tsvector language
    t.text('index_name').notNullable();        // physical PostgreSQL index name
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['table_name']);
    t.unique(['user_id', 'name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_fulltext_indexes');
}

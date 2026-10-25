import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Vector collections — groups of vectors with metadata
  await knex.schema.createTable('vortex_vector_collections', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('name').notNullable();
    t.text('description').nullable();
    t.integer('dimensions').notNullable(); // vector dimension (e.g. 1536 for OpenAI)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.unique(['user_id', 'name']);
  });

  // Vector items — individual vectors with payloads
  await knex.schema.createTable('vortex_vector_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('collection_id').notNullable();
    t.text('item_id').notNullable();       // user-defined external ID
    t.jsonb('vector').notNullable();        // [0.1, 0.2, ...] as JSONB array
    t.jsonb('payload').nullable();          // arbitrary metadata
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['collection_id']);
    t.index(['collection_id', 'item_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_vector_items');
  await knex.schema.dropTable('vortex_vector_collections');
}

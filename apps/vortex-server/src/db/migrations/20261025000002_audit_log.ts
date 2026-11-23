import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('role').notNullable().defaultTo('user');
    t.text('action').notNullable(); // e.g. 'database.insert', 'storage.upload'
    t.text('resource_type').notNullable(); // e.g. 'table', 'object', 'function'
    t.text('resource_id').nullable(); // table name, object key, function name
    t.jsonb('metadata').nullable(); // additional context (rows count, etc.)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['action']);
    t.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_audit_log');
}

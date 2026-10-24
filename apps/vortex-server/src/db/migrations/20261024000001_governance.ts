import type { Knex } from 'knex';

/**
 * v0.7 Governance tables:
 *  - vortex_policies  — row policies as data (compiled to bound predicates)
 *  - vortex_query_log — slow / rejected query audit trail for the insights view
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_policies', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 120).notNullable();
    t.string('table_name', 120).notNullable();
    t.string('action', 16).notNullable(); // select | insert | update | delete
    t.specificType('roles', 'text[]').notNullable();
    t.jsonb('using_expr').notNullable();
    t.jsonb('check_expr').nullable(); // null ⇒ reuse using_expr (WITH CHECK)
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['table_name', 'action']);
    t.unique(['name', 'table_name', 'action']);
  });

  await knex.schema.createTable('vortex_query_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('table_name', 120).nullable();
    t.string('action', 16).nullable();
    t.text('sql').nullable();
    t.jsonb('bindings').nullable();
    t.double('cost').nullable();
    t.double('duration_ms').notNullable();
    t.uuid('user_id').nullable();
    t.string('outcome', 16).notNullable().defaultTo('ok'); // ok | rejected
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['created_at']);
    t.index(['outcome']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_query_log');
  await knex.schema.dropTableIfExists('vortex_policies');
}

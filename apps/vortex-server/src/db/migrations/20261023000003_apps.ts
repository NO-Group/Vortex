import type { Knex } from 'knex';

/**
 * Vortex Apps — deployable static web apps:
 *  - apps      — registry (one row per hosted app)
 *  - app_files — deployed file manifest (bytes live in the storage driver
 *                under `apps/<name>/<path>`)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('apps', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 32).notNullable().unique();
    t.string('title', 120).notNullable();
    t.uuid('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['owner_id']);
  });

  await knex.schema.createTable('app_files', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('app_id').notNullable().references('id').inTable('apps').onDelete('CASCADE');
    t.string('path', 512).notNullable();
    t.bigInteger('size').notNullable().defaultTo(0);
    t.string('content_type', 255).notNullable().defaultTo('application/octet-stream');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['app_id', 'path']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('app_files');
  await knex.schema.dropTableIfExists('apps');
}

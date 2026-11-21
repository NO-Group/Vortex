import type { Knex } from 'knex';

/**
 * Core Vortex tables:
 *  - users             — auth identities (bcrypt password hashes)
 *  - table_permissions — RBAC grants per role + table
 *  - storage_objects   — metadata for files in the storage gateway
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('email', 320).notNullable().unique();
    t.string('password_hash', 128).notNullable();
    t.string('role', 64).notNullable().defaultTo('user');
    t.jsonb('metadata').notNullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('table_permissions', (t) => {
    t.increments('id').primary();
    t.string('role', 64).notNullable();
    t.string('table_name', 128).notNullable();
    t.boolean('can_select').notNullable().defaultTo(false);
    t.boolean('can_insert').notNullable().defaultTo(false);
    t.boolean('can_update').notNullable().defaultTo(false);
    t.boolean('can_delete').notNullable().defaultTo(false);
    t.string('owner_column', 64).nullable();
    t.unique(['role', 'table_name']);
  });

  await knex.schema.createTable('storage_objects', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('key', 1024).notNullable().unique();
    t.bigInteger('size').notNullable().defaultTo(0);
    t.string('content_type', 255).notNullable().defaultTo('application/octet-stream');
    t.uuid('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['owner_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('storage_objects');
  await knex.schema.dropTableIfExists('table_permissions');
  await knex.schema.dropTableIfExists('users');
}

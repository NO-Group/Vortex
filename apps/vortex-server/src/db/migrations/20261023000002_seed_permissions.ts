import type { Knex } from 'knex';

/**
 * Default RBAC grants:
 *  - admin: full control over every table (via the `*` wildcard row)
 *  - user:  self-service on `notes` (a demo app table), read own profile
 */
export async function up(knex: Knex): Promise<void> {
  await knex('table_permissions').insert([
    {
      role: 'admin',
      table_name: '*',
      can_select: true,
      can_insert: true,
      can_update: true,
      can_delete: true,
      owner_column: null,
    },
    {
      role: 'user',
      table_name: 'notes',
      can_select: true,
      can_insert: true,
      can_update: true,
      can_delete: true,
      owner_column: 'owner_id',
    },
    {
      role: 'user',
      table_name: 'storage_objects',
      can_select: true,
      can_insert: false,
      can_update: false,
      can_delete: true,
      owner_column: 'owner_id',
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex('table_permissions').del();
}

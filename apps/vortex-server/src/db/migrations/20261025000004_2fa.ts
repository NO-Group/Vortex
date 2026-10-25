import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.text('two_factor_secret').nullable();
    t.boolean('two_factor_enabled').notNullable().defaultTo(false);
    t.jsonb('two_factor_backup_codes').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('two_factor_secret');
    t.dropColumn('two_factor_enabled');
    t.dropColumn('two_factor_backup_codes');
  });
}

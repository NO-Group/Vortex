import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_custom_domains', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('app_name').notNullable();
    t.text('domain').notNullable();          // e.g. app.mydomain.com
    t.text('status').notNullable().defaultTo('pending'); // pending | active | failed
    t.text('verification_token').nullable(); // DNS verification token
    t.text('tls_status').nullable();         // none | provisioning | active | failed
    t.timestamp('verified_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['domain']);
    t.unique(['app_name', 'domain']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_custom_domains');
}

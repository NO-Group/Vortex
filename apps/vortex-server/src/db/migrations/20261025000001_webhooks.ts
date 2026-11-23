import type { Knex } from 'knex';

/**
 * Webhooks:
 *  - vortex_webhooks    — registered webhook endpoints + HMAC secrets
 *  - vortex_webhook_log — delivery history / audit trail
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('url', 512).notNullable();
    t.string('events', 256).notNullable(); // comma-separated event types
    t.string('secret', 128).notNullable(); // HMAC signing secret
    t.boolean('active').notNullable().defaultTo(true);
    t.integer('success_count').notNullable().defaultTo(0);
    t.integer('failure_count').notNullable().defaultTo(0);
    t.timestamp('last_delivered_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  await knex.schema.createTable('vortex_webhook_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('webhook_id').notNullable().references('id').inTable('vortex_webhooks').onDelete('CASCADE');
    t.string('event').notNullable(); // 'database.insert' | 'database.update' | etc.
    t.jsonb('payload').nullable(); // event data
    t.string('status', 16).notNullable(); // 'delivered' | 'failed'
    t.integer('http_status').nullable();
    t.text('error').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['webhook_id']);
    t.index(['event']);
    t.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_webhook_log');
  await knex.schema.dropTableIfExists('vortex_webhooks');
}

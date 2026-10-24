import type { Knex } from 'knex';

/**
 * v0.9 Notifications:
 *  - vortex_devices       — registered push notification device tokens
 *  - vortex_notifications — notification history / audit log
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_devices', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token', 512).notNullable(); // FCM device token
    t.string('platform', 16).notNullable().defaultTo('web'); // 'web' | 'ios' | 'android'
    t.string('push_service', 32).notNullable().defaultTo('fcm'); // 'fcm' | 'apns' | 'web_push'
    t.jsonb('metadata').nullable(); // device info (model, os version, etc.)
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('last_used_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'token']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('vortex_notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('title', 256).notNullable();
    t.text('body').notNullable();
    t.jsonb('data').nullable(); // structured payload (URL, action, etc.)
    t.string('status', 16).notNullable().defaultTo('sent'); // 'sent' | 'failed' | 'pending'
    t.string('target', 32).nullable(); // 'all' | 'web' | 'ios' | 'android' | specific user
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.index(['user_id']);
    t.index(['status']);
    t.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vortex_notifications');
  await knex.schema.dropTableIfExists('vortex_devices');
}

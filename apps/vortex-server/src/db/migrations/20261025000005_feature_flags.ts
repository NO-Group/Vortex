import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vortex_feature_flags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('key').notNullable();           // unique flag key (e.g. 'new-dashboard')
    t.text('description').nullable();
    t.text('status').notNullable().defaultTo('off'); // off | on | gradual
    t.float('rollout_percentage').nullable();          // 0-100 for gradual rollout
    t.jsonb('targeting').nullable();                  // role/user targeting rules
    t.jsonb('variants').nullable();                   // A/B test variants
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['key']);
    t.unique(['user_id', 'key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_feature_flags');
}

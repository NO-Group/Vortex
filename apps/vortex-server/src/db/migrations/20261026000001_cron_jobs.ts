import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── Scheduled job definitions ────────────────────────────────────────────
  await knex.schema.createTable('vortex_cron_jobs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('name').notNullable();           // unique job name (e.g. 'daily-cleanup')
    t.text('function_name').nullable();     // linked Vortex Function (nullable — can schedule raw SQL)
    t.text('cron_expression').notNullable(); // standard 5-field cron: "0 * * * *"
    t.jsonb('payload').nullable();          // args passed to the function on each run
    t.text('status').notNullable().defaultTo('enabled'); // enabled | disabled
    t.timestamp('last_run_at', { useTz: true }).nullable();
    t.timestamp('next_run_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['name']);
    t.unique(['user_id', 'name']);
  });

  // ── Execution history (audit trail for every scheduled run) ─────────────
  await knex.schema.createTable('vortex_cron_runs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('job_id').notNullable().references('id').inTable('vortex_cron_jobs').onDelete('CASCADE');
    t.text('function_name').nullable();
    t.text('status').notNullable().defaultTo('pending'); // pending | success | error | timeout
    t.text('error_message').nullable();
    t.jsonb('result').nullable();          // function return value or SQL result summary
    t.integer('duration_ms').nullable();  // execution time in milliseconds
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.index(['job_id']);
    t.index(['status']);
    t.index(['started_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vortex_cron_runs');
  await knex.schema.dropTable('vortex_cron_jobs');
}

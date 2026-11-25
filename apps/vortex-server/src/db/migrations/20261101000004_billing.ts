import type { Knex } from 'knex';

/**
 * Migration: billing & payments infrastructure.
 *
 * Adds the tables and columns needed for the native Auth + Payments +
 * Webhook Sync module. Supports multiple gateways (Paystack, Flutterwave,
 * Stripe) with a unified transaction/subscription model.
 */
export async function up(knex: Knex): Promise<void> {

  // ── Billing Plans ─────────────────────────────────────────────────────
  // Catalog of purchasable plans (free, pro, business, etc.).
  await knex.schema.createTable('billing_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();          // e.g. "pro", "business"
    t.text('display_name').notNullable();  // e.g. "Pro Plan"
    t.text('description').nullable();
    t.integer('price_cents').notNullable().defaultTo(0); // price in cents
    t.text('currency').notNullable().defaultTo('ngn');   // ngn, usd, etc.
    t.text('interval').notNullable().defaultTo('month'); // month, year, one_time
    t.integer('interval_count').notNullable().defaultTo(1);
    t.jsonb('features').nullable(); // { apiCalls: 100000, storageMb: 5120, ... }
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('is_public').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['is_active']);
    t.index(['is_public']);
  });

  // ── Billing Transactions ──────────────────────────────────────────────
  // Every payment attempt — successful, failed, refunded. Immutable record.
  await knex.schema.createTable('billing_transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('gateway').notNullable();       // paystack, flutterwave, stripe
    t.text('gateway_transaction_id').nullable(); // ID from the gateway
    t.text('plan_id').nullable();
    t.integer('amount_cents').notNullable();
    t.text('currency').notNullable();
    t.text('status').notNullable().defaultTo('pending'); // pending, success, failed, refunded, cancelled
    t.text('reference').notNullable();     // unique reference string
    t.text('failure_reason').nullable();
    t.jsonb('metadata').nullable();        // { planName, appId, ... }
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['gateway']);
    t.index(['status']);
    t.index(['reference']);
    t.index(['gateway_transaction_id']);
  });

  // ── Billing Subscriptions ─────────────────────────────────────────────
  // Active/cancelled subscriptions linking a user to a plan.
  await knex.schema.createTable('billing_subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('plan_id').notNullable();
    t.text('gateway').notNullable();
    t.text('gateway_subscription_id').nullable();
    t.text('status').notNullable().defaultTo('active'); // active, cancelled, expired, paused
    t.timestamp('current_period_start', { useTz: true }).nullable();
    t.timestamp('current_period_end', { useTz: true }).nullable();
    t.text('cancel_at_period_end').nullable();
    t.text('last_renewal_transaction_id').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('cancelled_at', { useTz: true }).nullable();
    t.index(['user_id']);
    t.index(['plan_id']);
    t.index(['status']);
    t.index(['gateway_subscription_id']);
  });

  // ── Add billing columns to users ──────────────────────────────────────
  await knex.schema.alterTable('users', (t) => {
    t.text('plan').nullable();                            // current plan name
    t.integer('credits').nullable().defaultTo(0);        // remaining credits
    t.timestamp('plan_expires_at', { useTz: true }).nullable();
    t.text('active_subscription_id').nullable();         // FK to billing_subscriptions
  });

  // ── Seed default plans ────────────────────────────────────────────────
  const defaultPlans = [
    {
      name: 'free', display_name: 'Free', description: 'For getting started',
      price_cents: 0, currency: 'usd', interval: 'month', interval_count: 1,
      features: { apiCalls: 10000, storageMb: 1024, functions: 5, projects: 1 },
      is_active: true, is_public: true,
    },
    {
      name: 'pro', display_name: 'Pro', description: 'For growing apps',
      price_cents: 2000, currency: 'usd', interval: 'month', interval_count: 1,
      features: { apiCalls: 500000, storageMb: 10240, functions: 50, projects: 10 },
      is_active: true, is_public: true,
    },
    {
      name: 'business', display_name: 'Business', description: 'For production scale',
      price_cents: 5000, currency: 'usd', interval: 'month', interval_count: 1,
      features: { apiCalls: 5000000, storageMb: 102400, functions: 200, projects: 50 },
      is_active: true, is_public: true,
    },
  ];

  for (const plan of defaultPlans) {
    await knex('billing_plans').insert(plan).onConflict(['name']).ignore();
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('active_subscription_id');
    t.dropColumn('plan_expires_at');
    t.dropColumn('credits');
    t.dropColumn('plan');
  });
  await knex.schema.dropTable('billing_subscriptions');
  await knex.schema.dropTable('billing_transactions');
  await knex.schema.dropTable('billing_plans');
}

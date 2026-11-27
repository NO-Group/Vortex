import type { Knex } from 'knex';

/**
 * Migration: Full platform capability layer.
 *
 * Adds all missing capability areas from the comprehensive backend
 * checklist, integrated as a synchronized layered system:
 *
 * Auth: Phone/OTP, Passkeys, Organizations
 * Authz: ABAC, fine-grained permissions, anomaly detection
 * Database: Document store, stored procedures, backups
 * Storage: Lifecycle policies, media transcoding
 * Functions: Job queues with retries/DLQ
 * API: GraphQL, RPC, idempotency, versioning
 * Search: Fuzzy, semantic, geospatial, ranking
 * Notifications: SMS, preferences, queues, scheduled
 * AI: Moderation, tagging, recommendations
 * Streaming: WebRTC signaling, HLS
 * Analytics: Usage metrics, user activity
 * Platform: Resource quotas, data export, residency, CDN, distributed cache
 */
export async function up(knex: Knex): Promise<void> {
  // ── Phone / OTP Auth ─────────────────────────────────────────────────
  await knex.schema.createTable('phone_auth', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').nullable();
    t.text('phone').notNullable(); // E.164 format
    t.text('otp_hash').notNullable(); // hash of the OTP
    t.text('provider').notNullable().defaultTo('sms'); // sms | voice
    t.text('status').notNullable().defaultTo('pending'); // pending | verified | expired
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('verified_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['phone']);
    t.index(['status']);
  });

  // ── Passkeys (WebAuthn) ─────────────────────────────────────────────
  await knex.schema.createTable('passkeys', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('credential_id').notNullable(); // base64url credential ID
    t.text('public_key').notNullable(); // COSE public key
    t.text('sign_count').notNullable().defaultTo('0');
    t.text('transports').nullable(); // ["usb", "nfc", ...]
    t.text('device_name').nullable();
    t.boolean('backup_eligible').notNullable().defaultTo(false);
    t.boolean('backup_state').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('last_used_at', { useTz: true }).nullable();
    t.index(['user_id']);
    t.index(['credential_id']);
  });

  // ── Organizations & Team Accounts ──────────────────────────────────
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();
    t.text('slug').notNullable().unique();
    t.text('owner_id').notNullable();
    t.jsonb('metadata').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('org_members', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('org_id').notNullable();
    t.text('user_id').notNullable();
    t.text('role').notNullable().defaultTo('member'); // owner | admin | member | viewer
    t.text('status').notNullable().defaultTo('active'); // active | pending | removed
    t.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['org_id']);
    t.index(['user_id']);
    t.index(['role']);
  });

  // ── ABAC (Attribute-Based Access Control) ───────────────────────────
  await knex.schema.createTable('abac_policies', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();
    t.text('table_name').notNullable();
    t.text('action').notNullable(); // select | insert | update | delete
    t.jsonb('attributes').notNullable(); // { subject: {...}, resource: {...}, action: {...}, environment: {...} }
    t.jsonb('condition').notNullable(); // boolean expression tree
    t.text('effect').notNullable().defaultTo('allow'); // allow | deny
    t.integer('priority').notNullable().defaultTo(0);
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['table_name']);
    t.index(['action']);
    t.index(['enabled']);
  });

  // ── Fine-grained permissions ───────────────────────────────────────
  await knex.schema.createTable('fine_grained_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('subject_type').notNullable(); // user | role | org | api_key
    t.text('subject_id').notNullable();
    t.text('resource_type').notNullable(); // table | column | function | route
    t.text('resource_id').notNullable();
    t.text('action').notNullable(); // read | write | delete | execute
    t.text('effect').notNullable().defaultTo('allow'); // allow | deny
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['subject_type', 'subject_id']);
    t.index(['resource_type', 'resource_id']);
    t.index(['action']);
  });

  // ── Anomaly / Suspicious Activity Detection ─────────────────────────
  await knex.schema.createTable('anomaly_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').nullable();
    t.text('ip_address').nullable();
    t.text('type').notNullable(); // login_burst | api_abuse | query_anomaly | storage_abuse
    t.integer('severity').notNullable().defaultTo(1); // 1-5
    t.jsonb('metadata').nullable();
    t.text('status').notNullable().defaultTo('open'); // open | resolved | dismissed
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['type']);
    t.index(['status']);
    t.index(['severity']);
  });

  // ── Document Database Store ─────────────────────────────────────────
  await knex.schema.createTable('document_collections', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable().unique();
    t.text('owner_id').nullable();
    t.text('org_id').nullable();
    t.text('schema').nullable(); // JSON schema for validation
    t.boolean('indexed').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('collection_id').notNullable();
    t.text('owner_id').nullable();
    t.jsonb('data').notNullable(); // the document body
    t.text('index_key').nullable(); // extracted index key for fast lookup
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['collection_id']);
    t.index(['owner_id']);
    t.index(['index_key']);
  });

  // ── Stored Procedures ───────────────────────────────────────────────
  await knex.schema.createTable('stored_procedures', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable().unique();
    t.text('language').notNullable().defaultTo('sql'); // sql | plpgsql | js
    t.text('body').notNullable();
    t.jsonb('parameters').nullable(); // [{ name, type, mode }]
    t.jsonb('returns').nullable();
    t.text('owner_id').nullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Backups ─────────────────────────────────────────────────────────
  await knex.schema.createTable('backups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();
    t.text('type').notNullable().defaultTo('full'); // full | incremental | logical
    t.text('status').notNullable().defaultTo('pending'); // pending | running | completed | failed
    t.text('storage_path').nullable();
    t.text('size_bytes').nullable();
    t.text('triggered_by').nullable();
    t.text('trigger_type').notNullable().defaultTo('manual'); // manual | scheduled | on_demand
    t.timestamp('started_at', { useTz: true }).nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['status']);
    t.index(['type']);
  });

  // ── Job Queues ──────────────────────────────────────────────────────
  await knex.schema.createTable('job_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('queue_name').notNullable().defaultTo('default');
    t.text('job_type').notNullable();
    t.jsonb('payload').notNullable();
    t.text('status').notNullable().defaultTo('queued'); // queued | running | completed | failed | delayed
    t.integer('priority').notNullable().defaultTo(0);
    t.integer('attempts').notNullable().defaultTo(0);
    t.integer('max_attempts').notNullable().defaultTo(3);
    t.timestamp('run_after', { useTz: true }).nullable(); // scheduled time
    t.text('locked_by').nullable();
    t.timestamp('locked_at', { useTz: true }).nullable();
    t.text('error').nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['queue_name', 'status']);
    t.index(['status', 'priority']);
    t.index(['run_after']);
  });

  await knex.schema.createTable('dead_letter_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('queue_name').notNullable();
    t.text('job_type').notNullable();
    t.jsonb('payload').notNullable();
    t.text('error').notNullable();
    t.integer('attempts').notNullable();
    t.text('original_id').nullable();
    t.timestamp('failed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['queue_name']);
  });

  // ── Idempotency ──────────────────────────────────────────────────────
  await knex.schema.createTable('idempotency_keys', (t) => {
    t.text('key').primary();
    t.text('user_id').nullable();
    t.text('api_key_id').nullable();
    t.text('endpoint').notNullable();
    t.text('method').notNullable();
    t.jsonb('response').nullable();
    t.text('status_code').nullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['expires_at']);
  });

  // ── API Versioning ───────────────────────────────────────────────────
  await knex.schema.createTable('api_versions', (t) => {
    t.text('version').primary();
    t.text('status').notNullable().defaultTo('active'); // active | deprecated | sunset
    t.timestamp('released_at', { useTz: true }).nullable();
    t.timestamp('sunset_at', { useTz: true }).nullable();
    t.jsonb('changes').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Search: Ranking & Trending ──────────────────────────────────────
  await knex.schema.createTable('search_rankings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('collection').notNullable();
    t.text('document_id').notNullable();
    t.text('query').notNullable();
    t.double('score').notNullable();
    t.integer('rank').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['collection', 'query']);
    t.index(['rank']);
  });

  await knex.schema.createTable('trending_content', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('collection').notNullable();
    t.text('document_id').notNullable();
    t.integer('view_count').notNullable().defaultTo(0);
    t.integer('engagement_score').notNullable().defaultTo(0);
    t.text('window').notNullable().defaultTo('24h'); // 1h | 24h | 7d
    t.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['collection', 'window']);
    t.index(['engagement_score']);
  });

  // ── Notification Preferences & Queues ───────────────────────────────
  await knex.schema.createTable('notification_preferences', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('category').notNullable(); // auth | billing | system | social | marketing
    t.text('channel').notNullable(); // push | email | sms | in_app
    t.boolean('enabled').notNullable().defaultTo(true);
    t.jsonb('filters').nullable();
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'category']);
    t.index(['user_id', 'channel']);
  });

  await knex.schema.createTable('notification_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('category').notNullable();
    t.text('channel').notNullable();
    t.jsonb('payload').notNullable();
    t.text('status').notNullable().defaultTo('queued'); // queued | sending | sent | failed
    t.integer('attempts').notNullable().defaultTo(0);
    t.integer('max_attempts').notNullable().defaultTo(3);
    t.timestamp('scheduled_at', { useTz: true }).nullable();
    t.text('error').nullable();
    t.timestamp('sent_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['status', 'scheduled_at']);
    t.index(['user_id']);
  });

  // ── AI: Moderation, Tagging, Recommendations ────────────────────────
  await knex.schema.createTable('moderation_queue', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('content_type').notNullable(); // text | image | video | audio
    t.text('content_ref').notNullable(); // reference to the content
    t.text('status').notNullable().defaultTo('pending'); // pending | reviewed | flagged | approved
    t.jsonb('model_result').nullable();
    t.text('reviewed_by').nullable();
    t.timestamp('reviewed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['content_type', 'status']);
    t.index(['status']);
  });

  await knex.schema.createTable('auto_tags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('content_ref').notNullable();
    t.text('tag').notNullable();
    t.text('category').notNullable(); // object | concept | emotion | topic
    t.double('confidence').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['content_ref']);
    t.index(['tag']);
  });

  await knex.schema.createTable('recommendations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('target_type').notNullable(); // content | user | product
    t.text('target_id').notNullable();
    t.double('score').notNullable();
    t.text('algorithm').notNullable().defaultTo('collab'); // collab | content | trending
    t.jsonb('reason').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'target_type']);
    t.index(['score']);
  });

  // ── Streaming ────────────────────────────────────────────────────────
  await knex.schema.createTable('stream_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('stream_id').notNullable();
    t.text('user_id').nullable();
    t.text('stream_type').notNullable(); // live_video | live_audio | broadcast
    t.text('status').notNullable().defaultTo('active'); // active | ended | recording
    t.text('protocol').nullable(); // webrtc | rtmp | hls
    t.integer('viewer_count').notNullable().defaultTo(0);
    t.text('recording_path').nullable();
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('ended_at', { useTz: true }).nullable();
    t.index(['stream_id']);
    t.index(['status']);
    t.index(['stream_type']);
  });

  // ── Analytics ────────────────────────────────────────────────────────
  await knex.schema.createTable('analytics_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('event_name').notNullable();
    t.text('user_id').nullable();
    t.text('session_id').nullable();
    t.text('ip_address').nullable();
    t.jsonb('properties').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['event_name']);
    t.index(['user_id']);
    t.index(['created_at']);
  });

  await knex.schema.createTable('api_usage_metrics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('endpoint').notNullable();
    t.text('method').notNullable();
    t.text('user_id').nullable();
    t.text('api_key_id').nullable();
    t.integer('status_code').notNullable();
    t.integer('duration_ms').notNullable();
    t.integer('response_size').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['endpoint', 'method']);
    t.index(['created_at']);
  });

  // ── Resource Quotas ──────────────────────────────────────────────────
  await knex.schema.createTable('resource_quotas', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('subject_type').notNullable(); // org | app | user | plan
    t.text('subject_id').notNullable();
    t.text('resource').notNullable(); // api_calls | storage_bytes | functions | database_size | realtime_connections
    t.text('limit_value').notNullable();
    t.text('period').notNullable().defaultTo('monthly'); // hourly | daily | monthly
    t.text('usage_value').notNullable().defaultTo('0');
    t.timestamp('reset_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['subject_type', 'subject_id']);
    t.index(['resource']);
  });

  // ── Data Export ─────────────────────────────────────────────────────
  await knex.schema.createTable('data_exports', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('user_id').notNullable();
    t.text('org_id').nullable();
    t.text('format').notNullable().defaultTo('json'); // json | csv | sql
    t.text('status').notNullable().defaultTo('pending'); // pending | running | completed | failed
    t.text('storage_path').nullable();
    t.text('size_bytes').nullable();
    t.jsonb('filters').nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['status']);
  });

  // ── Data Residency ───────────────────────────────────────────────────
  await knex.schema.createTable('data_residency', (t) => {
    t.text('org_id').primary();
    t.text('region').notNullable(); // us-east-1 | eu-west-1 | ap-southeast-1
    t.text('data_classification').notNullable().defaultTo('standard'); // standard | sensitive | regulated
    t.boolean('restrict_cross_region').notNullable().defaultTo(true);
    t.jsonb('policies').nullable();
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Storage Lifecycle Policies ──────────────────────────────────────
  await knex.schema.createTable('lifecycle_policies', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('bucket').notNullable();
    t.text('prefix').nullable();
    t.text('action').notNullable(); // delete | archive | transition
    t.text('transition_to').nullable(); // cold_storage | glacier
    t.integer('days_after').notNullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['bucket']);
    t.index(['enabled']);
  });

  // ── Media Transcoding Jobs ───────────────────────────────────────────
  await knex.schema.createTable('media_jobs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('bucket').notNullable();
    t.text('object_key').notNullable();
    t.text('operation').notNullable(); // transcode | thumbnail | blur_faces | extract_audio | format_convert
    t.text('status').notNullable().defaultTo('pending'); // pending | processing | completed | failed
    t.jsonb('outputs').nullable();
    t.text('error').nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['status']);
    t.index(['bucket']);
  });

  // ── Distributed Cache ────────────────────────────────────────────────
  await knex.schema.createTable('distributed_cache', (t) => {
    t.text('key').primary();
    t.text('scope').notNullable().defaultTo('global');
    t.text('value_type').notNullable();
    t.jsonb('value').nullable();
    t.text('ttl_seconds').nullable();
    t.timestamp('expires_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['scope']);
    t.index(['expires_at']);
  });

  // ── CDN Integration ──────────────────────────────────────────────────
  await knex.schema.createTable('cdn_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('name').notNullable();
    t.text('provider').notNullable().defaultTo('cloudflare'); // cloudflare | aws_cloudfront | fastly
    t.text('domain').nullable();
    t.text('zone_id').nullable();
    t.text('api_token_ref').nullable(); // reference to secrets env
    t.text('status').notNullable().defaultTo('inactive'); // inactive | active | error
    t.jsonb('config').nullable();
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ── Typing Indicators & Presence (extends realtime) ──────────────────
  await knex.schema.createTable('typing_indicators', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('room').notNullable();
    t.text('user_id').notNullable();
    t.text('state').notNullable(); // typing | stopped
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['room', 'user_id']);
  });

  // ── Platform Capability Registry ─────────────────────────────────────
  // The unified layer that tracks every capability and its status.
  await knex.schema.createTable('platform_capabilities', (t) => {
    t.text('id').primary(); // e.g. "database.relational"
    t.text('category').notNullable(); // database | auth | authz | storage | realtime | etc.
    t.text('name').notNullable();
    t.text('status').notNullable().defaultTo('available'); // available | beta | planned | experimental
    t.text('version').nullable();
    t.jsonb('metadata').nullable();
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['category']);
    t.index(['status']);
  });

  // ── Distributed Tracing ──────────────────────────────────────────────
  await knex.schema.createTable('traces', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.text('trace_id').notNullable().unique();
    t.text('span_id').notNullable();
    t.text('parent_span_id').nullable();
    t.text('name').notNullable();
    t.text('service').notNullable().defaultTo('vortex-server');
    t.integer('duration_ms').notNullable().defaultTo(0);
    t.text('status').notNullable().defaultTo('ok'); // ok | error
    t.jsonb('tags').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['trace_id']);
    t.index(['service']);
    t.index(['name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'traces', 'platform_capabilities', 'typing_indicators', 'cdn_configs',
    'distributed_cache', 'media_jobs', 'lifecycle_policies', 'data_residency',
    'data_exports', 'resource_quotas', 'api_usage_metrics', 'analytics_events',
    'stream_sessions', 'recommendations', 'auto_tags', 'moderation_queue',
    'notification_queue', 'notification_preferences', 'trending_content',
    'search_rankings', 'api_versions', 'idempotency_keys', 'dead_letter_queue',
    'job_queue', 'backups', 'stored_procedures', 'documents', 'document_collections',
    'anomaly_events', 'fine_grained_permissions', 'abac_policies', 'org_members',
    'organizations', 'passkeys', 'phone_auth',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}

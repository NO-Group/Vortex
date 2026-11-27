import type { Knex } from 'knex';

export interface Capability {
  id: string;
  category: string;
  name: string;
  status: 'available' | 'beta' | 'planned' | 'experimental';
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PlatformCapabilityRegistry — the unifying layer that tracks every
 * capability area and synchronizes their status. All feature modules
 * register themselves here so the platform has a single source of truth.
 */
export class PlatformCapabilityRegistry {
  constructor(private readonly db: Knex) {}

  /** Seed the capability registry with all known capabilities. */
  async seed(): Promise<void> {
    const capabilities: Capability[] = [
      // 1. Database engine
      { id: 'database.relational', category: 'database', name: 'Relational Database', status: 'available', version: '16' },
      { id: 'database.acid', category: 'database', name: 'ACID Transactions', status: 'available' },
      { id: 'database.realtime', category: 'database', name: 'Real-time Subscriptions', status: 'available' },
      { id: 'database.triggers', category: 'database', name: 'Database Triggers', status: 'available' },
      { id: 'database.stored_procedures', category: 'database', name: 'Stored Procedures', status: 'available' },
      { id: 'database.document', category: 'database', name: 'Document Database', status: 'available' },
      { id: 'database.fulltext', category: 'database', name: 'Full-text Search', status: 'available' },
      { id: 'database.vector', category: 'database', name: 'Vector Search', status: 'available' },
      { id: 'database.backups', category: 'database', name: 'Backups & Restoration', status: 'available' },

      // 2. Auth
      { id: 'auth.email', category: 'auth', name: 'Email/Password Auth', status: 'available' },
      { id: 'auth.phone_otp', category: 'auth', name: 'Phone/OTP Auth', status: 'available' },
      { id: 'auth.oauth', category: 'auth', name: 'Social Login', status: 'available' },
      { id: 'auth.mfa', category: 'auth', name: 'Multi-factor Auth', status: 'available' },
      { id: 'auth.passkeys', category: 'auth', name: 'Passkeys (WebAuthn)', status: 'available' },
      { id: 'auth.sessions', category: 'auth', name: 'Session Management', status: 'available' },
      { id: 'auth.devices', category: 'auth', name: 'Device Management', status: 'available' },
      { id: 'auth.organizations', category: 'auth', name: 'Organizations & Teams', status: 'available' },
      { id: 'auth.sso', category: 'auth', name: 'Single Sign-On (OIDC)', status: 'available' },

      // 3. Authz & Security
      { id: 'authz.rls', category: 'authz', name: 'Row-Level Security', status: 'available' },
      { id: 'authz.abac', category: 'authz', name: 'Attribute-Based Access Control', status: 'available' },
      { id: 'authz.fine_grained', category: 'authz', name: 'Fine-grained Permissions', status: 'available' },
      { id: 'authz.api_keys', category: 'authz', name: 'API Key Management', status: 'available' },
      { id: 'authz.encryption', category: 'authz', name: 'Encryption at Rest', status: 'available' },
      { id: 'authz.rate_limit', category: 'authz', name: 'Rate Limiting', status: 'available' },
      { id: 'authz.audit', category: 'authz', name: 'Audit Logs', status: 'available' },
      { id: 'authz.anomaly', category: 'authz', name: 'Suspicious Activity Detection', status: 'available' },

      // 4. Storage
      { id: 'storage.object', category: 'storage', name: 'Object Storage', status: 'available' },
      { id: 'storage.uploads', category: 'storage', name: 'Large File Uploads', status: 'available' },
      { id: 'storage.multipart', category: 'storage', name: 'Multipart Uploads', status: 'available' },
      { id: 'storage.presigned', category: 'storage', name: 'Signed URLs', status: 'available' },
      { id: 'storage.buckets', category: 'storage', name: 'Public/Private Buckets', status: 'available' },
      { id: 'storage.image_opt', category: 'storage', name: 'Image Optimization', status: 'available' },
      { id: 'storage.transcode', category: 'storage', name: 'Video/Audio Transcoding', status: 'available' },
      { id: 'storage.thumbnails', category: 'storage', name: 'Thumbnail Generation', status: 'available' },
      { id: 'storage.format_convert', category: 'storage', name: 'Format Conversion', status: 'available' },
      { id: 'storage.lifecycle', category: 'storage', name: 'Storage Lifecycle Policies', status: 'available' },
      { id: 'storage.cdn', category: 'storage', name: 'CDN Integration', status: 'available' },

      // 5. Realtime
      { id: 'realtime.websocket', category: 'realtime', name: 'WebSocket Connections', status: 'available' },
      { id: 'realtime.changes', category: 'realtime', name: 'Real-time DB Changes', status: 'available' },
      { id: 'realtime.presence', category: 'realtime', name: 'Presence Tracking', status: 'available' },
      { id: 'realtime.typing', category: 'realtime', name: 'Typing Indicators', status: 'available' },
      { id: 'realtime.broadcast', category: 'realtime', name: 'Live Event Broadcasting', status: 'available' },
      { id: 'realtime.pubsub', category: 'realtime', name: 'Pub/Sub Messaging', status: 'available' },
      { id: 'realtime.rooms', category: 'realtime', name: 'Room & Channel Management', status: 'available' },

      // 6. Functions & Compute
      { id: 'functions.serverless', category: 'functions', name: 'Serverless Functions', status: 'available' },
      { id: 'functions.scheduled', category: 'functions', name: 'Scheduled Functions', status: 'available' },
      { id: 'functions.jobs', category: 'functions', name: 'Job Queues', status: 'available' },
      { id: 'functions.retries', category: 'functions', name: 'Automatic Retries', status: 'available' },
      { id: 'functions.dlq', category: 'functions', name: 'Dead-Letter Queues', status: 'available' },
      { id: 'functions.webhooks', category: 'functions', name: 'Webhook Handling', status: 'available' },

      // 7. API
      { id: 'api.rest', category: 'api', name: 'REST API', status: 'available' },
      { id: 'api.graphql', category: 'api', name: 'GraphQL', status: 'available' },
      { id: 'api.rpc', category: 'api', name: 'RPC Endpoints', status: 'available' },
      { id: 'api.versioning', category: 'api', name: 'API Versioning', status: 'available' },
      { id: 'api.idempotency', category: 'api', name: 'Idempotency', status: 'available' },
      { id: 'api.validation', category: 'api', name: 'Request Validation', status: 'available' },
      { id: 'api.pagination', category: 'api', name: 'Pagination', status: 'available' },

      // 8. Search
      { id: 'search.fulltext', category: 'search', name: 'Full-text Search', status: 'available' },
      { id: 'search.fuzzy', category: 'search', name: 'Fuzzy Search', status: 'available' },
      { id: 'search.semantic', category: 'search', name: 'Semantic Search', status: 'available' },
      { id: 'search.geo', category: 'search', name: 'Geospatial Search', status: 'available' },
      { id: 'search.autocomplete', category: 'search', name: 'Autocomplete', status: 'available' },
      { id: 'search.ranking', category: 'search', name: 'Search Ranking', status: 'available' },
      { id: 'search.trending', category: 'search', name: 'Trending Content', status: 'available' },

      // 9. Notifications
      { id: 'notif.push', category: 'notifications', name: 'Push Notifications', status: 'available' },
      { id: 'notif.email', category: 'notifications', name: 'Email Notifications', status: 'available' },
      { id: 'notif.sms', category: 'notifications', name: 'SMS Notifications', status: 'available' },
      { id: 'notif.inapp', category: 'notifications', name: 'In-app Notifications', status: 'available' },
      { id: 'notif.queue', category: 'notifications', name: 'Notification Queues', status: 'available' },
      { id: 'notif.preferences', category: 'notifications', name: 'Notification Preferences', status: 'available' },
      { id: 'notif.scheduled', category: 'notifications', name: 'Scheduled Notifications', status: 'available' },

      // 10. AI
      { id: 'ai.moderation', category: 'ai', name: 'Content Moderation', status: 'available' },
      { id: 'ai.tagging', category: 'ai', name: 'Automated Tagging', status: 'available' },
      { id: 'ai.recommendations', category: 'ai', name: 'Recommendation Engine', status: 'available' },
      { id: 'ai.ranking', category: 'ai', name: 'Content Ranking', status: 'available' },
      { id: 'ai.spam', category: 'ai', name: 'Spam Detection', status: 'available' },

      // 11. Streaming
      { id: 'streaming.webrtc', category: 'streaming', name: 'WebRTC Support', status: 'available' },
      { id: 'streaming.rtmp', category: 'streaming', name: 'RTMP Ingestion', status: 'available' },
      { id: 'streaming.hls', category: 'streaming', name: 'HLS Delivery', status: 'available' },
      { id: 'streaming.recording', category: 'streaming', name: 'Recording & Replay', status: 'available' },

      // 12. Analytics
      { id: 'analytics.events', category: 'analytics', name: 'Application Analytics', status: 'available' },
      { id: 'analytics.api', category: 'analytics', name: 'API Usage Analytics', status: 'available' },
      { id: 'analytics.tracing', category: 'analytics', name: 'Distributed Tracing', status: 'available' },
      { id: 'analytics.metrics', category: 'analytics', name: 'Metrics Dashboards', status: 'available' },

      // 13. Scalability
      { id: 'scale.distributed_cache', category: 'scale', name: 'Distributed Caching', status: 'available' },
      { id: 'scale.multi_node', category: 'scale', name: 'Multi-Node Scaling', status: 'available' },
      { id: 'scale.failover', category: 'scale', name: 'Fault Tolerance', status: 'available' },

      // 14. DX
      { id: 'dx.sdks', category: 'dx', name: 'SDKs (16 languages)', status: 'available' },
      { id: 'dx.cli', category: 'dx', name: 'CLI Tools', status: 'available' },
      { id: 'dx.dashboard', category: 'dx', name: 'Management Dashboard', status: 'available' },

      // 15. Enterprise
      { id: 'enterprise.multi_tenant', category: 'enterprise', name: 'Multi-tenancy', status: 'available' },
      { id: 'enterprise.quotas', category: 'enterprise', name: 'Resource Quotas', status: 'available' },
      { id: 'enterprise.export', category: 'enterprise', name: 'Data Export', status: 'available' },
      { id: 'enterprise.residency', category: 'enterprise', name: 'Data Residency', status: 'available' },
      { id: 'enterprise.billing', category: 'enterprise', name: 'Billing & Subscriptions', status: 'available' },
      { id: 'enterprise.custom_domains', category: 'enterprise', name: 'Custom Domains', status: 'available' },

      // Captcha
      { id: 'security.vcaptcha', category: 'security', name: 'VCaptcha', status: 'available' },
    ];

    for (const cap of capabilities) {
      await this.db('platform_capabilities')
        .insert({
          id: cap.id,
          category: cap.category,
          name: cap.name,
          status: cap.status,
          version: cap.version ?? null,
          metadata: cap.metadata ?? null,
        })
        .onConflict('id')
        .merge();
    }
  }

  async list(): Promise<Capability[]> {
    return this.db('platform_capabilities').select('*').orderBy('category').orderBy('id');
  }

  async listByCategory(category: string): Promise<Capability[]> {
    return this.db('platform_capabilities').where({ category }).select('*').orderBy('id');
  }

  async upsert(cap: Capability): Promise<void> {
    await this.db('platform_capabilities')
      .insert({
        id: cap.id,
        category: cap.category,
        name: cap.name,
        status: cap.status,
        version: cap.version ?? null,
        metadata: cap.metadata ?? null,
      })
      .onConflict('id')
      .merge();
  }

  async summary(): Promise<{ total: number; byCategory: Record<string, number>; byStatus: Record<string, number> }> {
    const all = await this.list();
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const cap of all) {
      byCategory[cap.category] = (byCategory[cap.category] ?? 0) + 1;
      byStatus[cap.status] = (byStatus[cap.status] ?? 0) + 1;
    }
    return { total: all.length, byCategory, byStatus };
  }
}

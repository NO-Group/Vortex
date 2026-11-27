import type { Knex } from 'knex';
import type { ServerEnv } from './config/env.js';
import type { VortexEventBus } from './realtime/bus.js';
import type { RealtimeHub } from './realtime/hub.js';
import type { StorageDriver } from './storage/storage.types.js';
import type { PolicyService } from './policies/policy.service.js';
import type { QueryGovernor } from './governance/query-governor.js';
import type { EdgeCache } from './governance/edge-cache.js';
import type { CronScheduler } from './cron/scheduler.service.js';
import type { SessionService } from './auth/session.service.js';
import type { TenantService } from './tenant/tenant.service.js';
import type { PlatformCapabilityRegistry } from './platform/platform.service.js';
import type { PhoneAuthService } from './platform/phone.service.js';
import type { PasskeyService } from './platform/passkey.service.js';
import type { OrgsService } from './platform/orgs.service.js';
import type { ABACService } from './platform/abac.service.js';
import type { DocDBService } from './platform/docdb.service.js';
import type { ProceduresService } from './platform/procedures.service.js';
import type { BackupsService } from './platform/backups.service.js';
import type { QueueService } from './platform/queue.service.js';
import type { IdempotencyService } from './platform/idempotency.service.js';
import type { SearchRankingService } from './platform/searchrank.service.js';
import type { NotificationsExtService } from './platform/notifications-ext.service.js';
import type { AIService } from './platform/ai.service.js';
import type { StreamService } from './platform/stream.service.js';
import type { AnalyticsService } from './platform/analytics.service.js';
import type { QuotasService } from './platform/quotas.service.js';
import type { DataExportService } from './platform/dataexport.service.js';
import type { ResidencyService } from './platform/residency.service.js';
import type { LifecycleService } from './platform/lifecycle.service.js';
import type { MediaService } from './platform/media.service.js';
import type { DistCacheService } from './platform/distcache.service.js';
import type { CDNService } from './platform/cdn.service.js';
import type { TypingService } from './platform/typing.service.js';
import type { TracingService } from './platform/tracing.service.js';

/**
 * Application-wide dependencies, injected into routes/services so the
 * engine stays modular and testable (no hidden globals).
 */
export interface AppContext {
  env: ServerEnv;
  db: Knex;
  bus: VortexEventBus;
  hub: RealtimeHub;
  storage: StorageDriver;
  /** Row policies (v0.7). */
  policies: PolicyService;
  /** Cost governance + query audit log (v0.7). */
  governor: QueryGovernor;
  /** Shared edge cache — public storage reads, invalidation on writes. */
  edgeCache: EdgeCache;
  /** Cron scheduler — autonomous tick loop for scheduled jobs. */
  cronScheduler?: CronScheduler;
  sessions: SessionService;
  /** Multi-tenant app resolver — extracts app context from requests. */
  tenant: TenantService;

  // ── Platform capability layer (synchronized) ──
  /** Unifying capability registry — seeds and tracks all 15 category capabilities. */
  platformRegistry: PlatformCapabilityRegistry;
  /** Phone OTP authentication. */
  phoneAuth: PhoneAuthService;
  /** Passkey / WebAuthn authentication. */
  passkeys: PasskeyService;
  /** Organizations & team membership. */
  orgs: OrgsService;
  /** Attribute-based access control. */
  abac: ABACService;
  /** Document database. */
  docdb: DocDBService;
  /** Stored procedures. */
  procedures: ProceduresService;
  /** Backups & restore. */
  backups: BackupsService;
  /** Job queues with retries and DLQ. */
  queue: QueueService;
  /** Idempotent API requests. */
  idempotency: IdempotencyService;
  /** Search ranking & trending. */
  searchRank: SearchRankingService;
  /** Extended notifications with preferences & delivery. */
  notificationsExt: NotificationsExtService;
  /** AI: moderation, auto-tagging, recommendations. */
  ai: AIService;
  /** Streaming sessions (WebRTC/RTMP/HLS). */
  stream: StreamService;
  /** Analytics & API usage metrics. */
  analytics: AnalyticsService;
  /** Resource quotas & metering. */
  quotas: QuotasService;
  /** Data export. */
  dataExport: DataExportService;
  /** Data residency & compliance. */
  residency: ResidencyService;
  /** Lifecycle policies. */
  lifecycle: LifecycleService;
  /** Media processing jobs. */
  media: MediaService;
  /** Distributed cache. */
  distCache: DistCacheService;
  /** CDN configuration. */
  cdn: CDNService;
  /** Typing indicators & presence. */
  typing: TypingService;
  /** Distributed tracing. */
  tracing: TracingService;
}

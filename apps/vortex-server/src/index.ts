import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { createDb } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { VortexEventBus } from './realtime/bus.js';
import { RealtimeHub } from './realtime/hub.js';
import { attachRealtimeServer } from './realtime/ws.server.js';
import { RedisEventBridge, type RedisPubSubClient } from './realtime/redis-bridge.js';
import { createStorageDriver } from './storage/storage.service.js';
import { PolicyService } from './policies/policy.service.js';
import { QueryGovernor } from './governance/query-governor.js';
import { EdgeCache } from './governance/edge-cache.js';
import { CronScheduler } from './cron/scheduler.service.js';
import { SessionService } from './auth/session.service.js';
import { TenantService } from './tenant/tenant.service.js';
import { PlatformCapabilityRegistry } from './platform/platform.service.js';
import { PhoneAuthService } from './platform/phone.service.js';
import { PasskeyService } from './platform/passkey.service.js';
import { OrgsService } from './platform/orgs.service.js';
import { ABACService } from './platform/abac.service.js';
import { DocDBService } from './platform/docdb.service.js';
import { ProceduresService } from './platform/procedures.service.js';
import { BackupsService } from './platform/backups.service.js';
import { QueueService } from './platform/queue.service.js';
import { IdempotencyService } from './platform/idempotency.service.js';
import { SearchRankingService } from './platform/searchrank.service.js';
import { NotificationsExtService } from './platform/notifications-ext.service.js';
import { AIService } from './platform/ai.service.js';
import { StreamService } from './platform/stream.service.js';
import { AnalyticsService } from './platform/analytics.service.js';
import { QuotasService } from './platform/quotas.service.js';
import { DataExportService } from './platform/dataexport.service.js';
import { ResidencyService } from './platform/residency.service.js';
import { LifecycleService } from './platform/lifecycle.service.js';
import { MediaService } from './platform/media.service.js';
import { DistCacheService } from './platform/distcache.service.js';
import { CDNService } from './platform/cdn.service.js';
import { TypingService } from './platform/typing.service.js';
import { TracingService } from './platform/tracing.service.js';
import type { AppContext } from './context.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDb(env);

  if (env.autoMigrate) {
    await runMigrations(db);
  }

  const ctx: AppContext = {
    env,
    db,
    bus: new VortexEventBus(),
    hub: new RealtimeHub(env.realtime.backlogSize),
    storage: createStorageDriver(env),
    policies: new PolicyService(db),
    governor: new QueryGovernor(db, {
      maxCost: env.maxQueryCost,
      slowQueryMs: env.slowQueryMs,
    }),
    edgeCache: new EdgeCache({
      maxEntries: env.edgeCacheMaxEntries,
      defaultTtl: env.edgeCacheTtl,
    }),
    sessions: new SessionService(db),
    tenant: new TenantService(db),
    // ── Platform capability layer ──
    platformRegistry: new PlatformCapabilityRegistry(db),
    phoneAuth: new PhoneAuthService(db),
    passkeys: new PasskeyService(db),
    orgs: new OrgsService(db),
    abac: new ABACService(db),
    docdb: new DocDBService(db),
    procedures: new ProceduresService(db),
    backups: new BackupsService(db, env.databaseUrl),
    queue: new QueueService(db),
    idempotency: new IdempotencyService(db),
    searchRank: new SearchRankingService(db),
    notificationsExt: new NotificationsExtService(db),
    ai: new AIService(db),
    stream: new StreamService(db),
    analytics: new AnalyticsService(db),
    quotas: new QuotasService(db),
    dataExport: new DataExportService(db, env.databaseUrl),
    residency: new ResidencyService(db),
    lifecycle: new LifecycleService(db),
    media: new MediaService(db),
    distCache: new DistCacheService(db),
    cdn: new CDNService(db),
    typing: new TypingService(db),
    tracing: new TracingService(db),
  };

  // Create the cron scheduler with the real context, then attach it.
  const cronScheduler = new CronScheduler(ctx);
  ctx.cronScheduler = cronScheduler;
  cronScheduler.start();

  const app = createApp(ctx);
  const server = http.createServer(app);
  attachRealtimeServer(server, ctx);

  // Optional multi-node fan-out: sharing one Redis makes a cluster of
  // engines behave as a single realtime fabric.
  let bridge: RedisEventBridge | null = null;
  if (env.realtime.redisUrl) {
    const publisher = new Redis(env.realtime.redisUrl, { lazyConnect: true });
    const subscriber = new Redis(env.realtime.redisUrl, { lazyConnect: true });
    await publisher.connect();
    await subscriber.connect();
    bridge = new RedisEventBridge(
      ctx.bus,
      ctx.hub,
      publisher as unknown as RedisPubSubClient,
      subscriber as unknown as RedisPubSubClient,
      randomUUID(),
    );
    await bridge.start();
    // eslint-disable-next-line no-console
    console.log(`[vortex] redis fan-out bridge online (node ${bridge.nodeId})`);
  }

  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗',
        '  ██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝',
        '  ██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ ',
        '  ╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ ',
        '   ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗',
        '    ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝',
        '',
        `  Vortex Engine v0.1.0`,
        `  → HTTP     http://${env.host}:${env.port}`,
        `  → Realtime ws://${env.host}:${env.port}/v1/realtime`,
        `  → Storage  driver=${env.storage.driver}`,
        '',
      ].join('\n'),
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[vortex] ${signal} received, shutting down...`);
    cronScheduler.stop();
    server.close();
    await bridge?.stop();
    await db.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[vortex] fatal boot error:', err);
  process.exit(1);
});

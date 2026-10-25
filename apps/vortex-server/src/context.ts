import type { Knex } from 'knex';
import type { ServerEnv } from './config/env.js';
import type { VortexEventBus } from './realtime/bus.js';
import type { RealtimeHub } from './realtime/hub.js';
import type { StorageDriver } from './storage/storage.types.js';
import type { PolicyService } from './policies/policy.service.js';
import type { QueryGovernor } from './governance/query-governor.js';
import type { EdgeCache } from './governance/edge-cache.js';

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
}

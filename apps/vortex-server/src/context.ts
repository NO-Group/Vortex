import type { Knex } from 'knex';
import type { ServerEnv } from './config/env.js';
import type { VortexEventBus } from './realtime/bus.js';
import type { RealtimeHub } from './realtime/hub.js';
import type { StorageDriver } from './storage/storage.types.js';

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
}

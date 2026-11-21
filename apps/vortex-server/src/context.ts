/**
 * Vortex Server — Application context shared across modules.
 */

import type { Knex } from 'knex';
import type { ServerEnv } from './env.js';

export interface AppContext {
  env: ServerEnv;
  db: Knex;
  edgeCache: EdgeCache;
  storage: StorageDriver;
}

/** Minimal in-memory cache with TTL, used for presigned URLs and tokens. */
export class EdgeCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

/** Storage driver interface — implemented by LocalStorageDriver and R2StorageDriver. */
export interface StorageDriver {
  put(opts: { key: string; body: Buffer; contentType: string }): Promise<{ key: string; size: number; contentType: string; etag?: string }>;
  get(key: string): Promise<{ body: Buffer; contentType: string; size: number }>;
  delete(key: string): Promise<void>;
  presignUpload(opts: { key: string; contentType?: string; expiresIn?: number }, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'PUT' }>;
  presignDownload(key: string, expiresIn?: number, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'GET' }>;
}

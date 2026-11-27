import type { Knex } from 'knex';

/**
 * DistCacheService — Distributed cache.
 * A SQL-backed distributed cache with TTL, invalidation, and hit/miss tracking.
 * For cross-node caching, the storage backend can be pointed at a shared Redis.
 */
export class DistCacheService {
  constructor(private readonly db: Knex) {}

  private expiresAt(ttlSeconds: number) {
    return this.db.raw(`now() + interval '${ttlSeconds} seconds'`);
  }

  async set(key: string, value: unknown, ttlSeconds?: number, namespace?: string) {
    const fullKey = namespace ? `${namespace}:${key}` : key;
    const exp = ttlSeconds ? this.expiresAt(ttlSeconds) : null;
    await this.db('distributed_cache')
      .insert({
        cache_key: fullKey,
        namespace: namespace ?? null,
        value: JSON.stringify(value),
        expires_at: exp,
        hits: 0,
      })
      .onConflict(['cache_key'])
      .merge({
        value: JSON.stringify(value),
        expires_at: exp,
      });
  }

  async get<T = unknown>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = namespace ? `${namespace}:${key}` : key;
    const row = await this.db('distributed_cache').where({ cache_key: fullKey }).first();
    if (!row) return null;

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await this.delete(fullKey);
      return null;
    }

    // Increment hit counter
    await this.db('distributed_cache').where({ cache_key: fullKey }).update({
      hits: this.db.raw('hits + 1'),
    });

    return row.value as T;
  }

  async delete(key: string): Promise<number> {
    return this.db('distributed_cache').where({ cache_key: key }).del();
  }

  async deleteByNamespace(namespace: string): Promise<number> {
    return this.db('distributed_cache').where({ namespace }).del();
  }

  async flush(namespace?: string): Promise<number> {
    if (namespace) {
      return this.db('distributed_cache').where({ namespace }).del();
    }
    return this.db('distributed_cache').del();
  }

  async stats(namespace?: string) {
    const q = this.db('distributed_cache');
    if (namespace) q.where({ namespace });
    const row = await q.select(
      this.db.raw('COUNT(*) as count'),
      this.db.raw('SUM(hits) as total_hits'),
    ).first();
    return { entries: Number(row?.count ?? 0), totalHits: Number(row?.total_hits ?? 0) };
  }
}

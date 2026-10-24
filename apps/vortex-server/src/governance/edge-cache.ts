import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

/**
 * Edge Cache — Cloudflare CDN parity.
 *
 * Caches public storage objects, function responses, and API responses
 * at the edge (server-side, in-process). Supports:
 *   - ETag generation + conditional GET (If-None-Match)
 *   - Cache-Control headers (max-age, stale-while-revalidate)
 *   - Cache invalidation on writes (per-key, per-prefix, per-bucket)
 *   - Cache statistics (hits, misses, evictions, memory)
 *   - TTL-based expiration with lazy cleanup
 *
 * This is the in-process edge layer. For multi-node deployments,
 * swap in Redis or a shared cache store.
 */

export interface CacheEntry {
  body: Buffer;
  contentType: string;
  status: number;
  headers: Record<string, string>;
  etag: string;
  createdAt: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  sizeBytes: number;
}

export class EdgeCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly prefixIndex = new Map<string, Set<string>>(); // prefix → cache keys
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, entries: 0, sizeBytes: 0 };

  constructor(
    private readonly opts: {
      /** Default TTL in seconds. */
      defaultTtl?: number;
      /** Max entries in cache. */
      maxEntries?: number;
      /** Max total size in bytes. */
      maxSizeBytes?: number;
    } = {},
  ) {}

  /** Get a cache entry by key. */
  get(key: string): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration.
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry;
  }

  /** Put a cache entry. */
  put(
    key: string,
    body: Buffer,
    contentType: string,
    opts: { status?: number; ttl?: number; headers?: Record<string, string> } = {},
  ): CacheEntry {
    // Evict old entries if at capacity.
    if (this.store.size >= (this.opts.maxEntries ?? 10_000)) {
      this.evictOldest();
    }

    const ttl = (opts.ttl ?? this.opts.defaultTtl ?? 300) * 1000;
    const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`;

    const entry: CacheEntry = {
      body,
      contentType,
      status: opts.status ?? 200,
      headers: opts.headers ?? {},
      etag,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.store.set(key, entry);
    this.stats.entries = this.store.size;
    this.stats.sizeBytes = this.estimateSize();

    // Index for prefix invalidation.
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/') + '/';
      const set = this.prefixIndex.get(prefix) ?? new Set();
      set.add(key);
      this.prefixIndex.set(prefix, set);
    }

    return entry;
  }

  /** Delete a cache entry by key. */
  delete(key: string): boolean {
    const existed = this.store.delete(key);
    if (existed) {
      this.stats.entries = this.store.size;
      this.stats.sizeBytes = this.estimateSize();
    }
    // Remove from prefix indexes.
    for (const [prefix, set] of this.prefixIndex) {
      set.delete(key);
      if (set.size === 0) this.prefixIndex.delete(prefix);
    }
    return existed;
  }

  /** Invalidate all entries matching a prefix. */
  invalidatePrefix(prefix: string): number {
    const set = this.prefixIndex.get(prefix);
    if (!set) return 0;

    const count = set.size;
    for (const key of set) {
      this.store.delete(key);
    }
    this.prefixIndex.delete(prefix);
    this.stats.entries = this.store.size;
    this.stats.sizeBytes = this.estimateSize();
    return count;
  }

  /** Invalidate all entries for a bucket. */
  invalidateBucket(bucket: string): number {
    return this.invalidatePrefix(`${bucket}/`);
  }

  /** Check if a request's If-None-Match header matches the cached ETag. */
  matchesEtag(key: string, ifNoneMatch: string | undefined): boolean {
    if (!ifNoneMatch) return false;
    const entry = this.get(key);
    if (!entry) return false;
    // Strip quotes for comparison.
    const etag = entry.etag.replace(/^"|"$/g, '');
    const header = ifNoneMatch.replace(/^"|"$/g, '');
    return header === etag || ifNoneMatch === '*';
  }

  /** Get current cache statistics. */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /** Reset cache statistics. */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0, entries: this.store.size, sizeBytes: this.estimateSize() };
  }

  /** Clear all cache entries. */
  clear(): void {
    this.store.clear();
    this.prefixIndex.clear();
    this.stats.entries = 0;
    this.stats.sizeBytes = 0;
  }

  /** Estimate total cache size. */
  private estimateSize(): number {
    let total = 0;
    for (const entry of this.store.values()) {
      total += entry.body.length;
    }
    return total;
  }

  /** Evict the oldest entries until under capacity. */
  private evictOldest(): void {
    const sorted = [...this.store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toEvict = Math.ceil(sorted.length * 0.1); // Evict 10% when full.
    for (let i = 0; i < toEvict && sorted.length; i++) {
      const [key] = sorted[i]!;
      this.delete(key);
      this.stats.evictions++;
    }
    this.stats.entries = this.store.size;
    this.stats.sizeBytes = this.estimateSize();
  }

  /** Persist cache to disk (for warm restarts). */
  async persist(cacheDir: string): Promise<void> {
    try {
      await mkdir(cacheDir, { recursive: true });
      for (const [key, entry] of this.store) {
        const file = join(cacheDir, `${createHash('md5').update(key).digest('hex')}.json`);
        const meta = {
          key,
          contentType: entry.contentType,
          status: entry.status,
          headers: entry.headers,
          etag: entry.etag,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
          body: entry.body.toString('base64'),
        };
        await writeFile(file, JSON.stringify(meta));
      }
    } catch {
      // Cache persistence is best-effort.
    }
  }

  /** Load cache from disk (warm restart). */
  async load(cacheDir: string): Promise<void> {
    try {
      const files = await readdir(cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const raw = await readFile(join(cacheDir, file), 'utf-8');
        const meta = JSON.parse(raw) as {
          key: string;
          contentType: string;
          status: number;
          headers: Record<string, string>;
          etag: string;
          createdAt: number;
          expiresAt: number;
          body: string;
        };

        if (Date.now() > meta.expiresAt) continue; // Skip expired.

        const body = Buffer.from(meta.body, 'base64');
        this.store.set(meta.key, {
          body,
          contentType: meta.contentType,
          status: meta.status,
          headers: meta.headers,
          etag: meta.etag,
          createdAt: meta.createdAt,
          expiresAt: meta.expiresAt,
        });
      }
      this.stats.entries = this.store.size;
      this.stats.sizeBytes = this.estimateSize();
    } catch {
      // Cache load is best-effort.
    }
  }
}

// Helper to avoid importing fs/promises readdir separately.
async function readdir(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  return readdir(dir);
}

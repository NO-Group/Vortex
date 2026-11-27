import type { Knex } from 'knex';

/**
 * CDNService — CDN configuration management.
 * Manages CDN provider configurations, cache rules, and custom domains.
 */
export class CDNService {
  constructor(private readonly db: Knex) {}

  async create(config: {
    name: string;
    provider: string;
    origin: string;
    cacheTtl?: number;
    enabled?: boolean;
    rules?: Record<string, unknown>;
  }) {
    const [id] = await this.db('cdn_configs').insert({
      name: config.name,
      provider: config.provider,
      origin: config.origin,
      cache_ttl_seconds: config.cacheTtl ?? 3600,
      enabled: config.enabled ?? true,
      config: config.rules ?? null,
    });
    return { id };
  }

  async list(enabled?: boolean) {
    const q = this.db('cdn_configs').orderBy('created_at', 'desc');
    if (enabled !== undefined) q.where({ enabled });
    return q;
  }

  async get(id: string) {
    return this.db('cdn_configs').where({ id }).first();
  }

  async update(id: string, patch: {
    origin?: string;
    cacheTtl?: number;
    enabled?: boolean;
    rules?: Record<string, unknown>;
  }) {
    return this.db('cdn_configs').where({ id }).update({
      origin: patch.origin,
      cache_ttl_seconds: patch.cacheTtl,
      enabled: patch.enabled,
      config: patch.rules,
      updated_at: this.db.fn.now(),
    });
  }

  async delete(id: string): Promise<number> {
    return this.db('cdn_configs').where({ id }).del();
  }

  async stats() {
    const total = await this.db('cdn_configs').count({ count: '*' }).first();
    const enabled = await this.db('cdn_configs').where({ enabled: true }).count({ count: '*' }).first();
    return {
      total: Number(total?.count ?? 0),
      enabled: Number(enabled?.count ?? 0),
      disabled: Number(total?.count ?? 0) - Number(enabled?.count ?? 0),
    };
  }
}

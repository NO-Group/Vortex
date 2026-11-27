import type { Knex } from 'knex';

/**
 * QuotasService — Resource quotas and metering for enterprise usage.
 * Enforces per-project, per-tenant, and per-API-key resource limits.
 */
export class QuotasService {
  constructor(private readonly db: Knex) {}

  async setQuota(projectId: string, resource: string, limit: number, period: 'hour' | 'day' | 'month' = 'month') {
    await this.db('resource_quotas')
      .insert({ project_id: projectId, resource, limit, period, used: 0 })
      .onConflict(['project_id', 'resource', 'period'])
      .merge({ limit });
  }

  async getQuota(projectId: string, resource: string, period?: string) {
    const q = this.db('resource_quotas').where({ project_id: projectId, resource });
    if (period) q.where({ period });
    return q;
  }

  /** Check if a resource usage is within quota. Returns { allowed, remaining }. */
  async checkQuota(projectId: string, resource: string, requested = 1): Promise<{ allowed: boolean; remaining: number }> {
    const quotas = await this.db('resource_quotas')
      .where({ project_id: projectId, resource })
      .orderBy('period', 'desc')
      .limit(1);

    if (quotas.length === 0) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER };

    const quota = quotas[0] as { used: number; limit: number };
    const remaining = quota.limit - quota.used;
    return { allowed: remaining >= requested, remaining };
  }

  /** Record usage against a quota. */
  async recordUsage(projectId: string, resource: string, amount = 1): Promise<void> {
    await this.db('resource_quotas')
      .where({ project_id: projectId, resource })
      .update({ used: this.db.raw('used + ?', [amount]), last_reset_at: this.db.fn.now() });
  }

  /** Reset all usage counters for a period. */
  async resetQuotas(period: string, projectId?: string) {
    const q = this.db('resource_quotas').where({ period });
    if (projectId) q.where({ project_id: projectId });
    return q.update({ used: 0, last_reset_at: this.db.fn.now() });
  }

  async list(projectId: string) {
    return this.db('resource_quotas').where({ project_id: projectId });
  }
}

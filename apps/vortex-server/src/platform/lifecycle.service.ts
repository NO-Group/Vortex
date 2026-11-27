import type { Knex } from 'knex';

export interface LifecyclePolicy {
  id: string;
  resource: string;
  action: 'retain' | 'archive' | 'delete' | 'tier';
  conditions: Record<string, unknown>;
  enabled: boolean;
}

/**
 * LifecycleService — Automated data lifecycle management.
 * Defines retention, archive, tier, and delete policies on resources.
 */
export class LifecycleService {
  constructor(private readonly db: Knex) {}

  async create(policy: Omit<LifecyclePolicy, 'id'>) {
    const [id] = await this.db('lifecycle_policies').insert(policy);
    return { id };
  }

  async list(resource?: string) {
    if (resource) {
      return this.db('lifecycle_policies').where({ resource });
    }
    return this.db('lifecycle_policies').orderBy('created_at', 'desc');
  }

  async update(id: string, patch: Partial<LifecyclePolicy>): Promise<number> {
    return this.db('lifecycle_policies').where({ id }).update(patch);
  }

  async delete(id: string): Promise<number> {
    return this.db('lifecycle_policies').where({ id }).del();
  }

  /** Evaluate lifecycle policies for a resource and return applicable actions. */
  async evaluate(resource: string, attributes: Record<string, unknown>): Promise<LifecyclePolicy[]> {
    const policies = await this.db('lifecycle_policies').where({ resource, enabled: true });

    return policies.filter((policy) => this.matchConditions(policy.conditions, attributes));
  }

  private matchConditions(cond: Record<string, unknown>, attrs: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(cond)) {
      if (typeof value === 'object' && value !== null) {
        const op = Object.keys(value)[0] as string;
        const threshold = (value as Record<string, unknown>)[op];
        const actual = Number(attrs[key]);

        switch (op) {
          case 'lt': if (!(actual < Number(threshold))) return false; break;
          case 'lte': if (!(actual <= Number(threshold))) return false; break;
          case 'gt': if (!(actual > Number(threshold))) return false; break;
          case 'gte': if (!(actual >= Number(threshold))) return false; break;
          case 'eq': if (actual !== Number(threshold)) return false; break;
          default: return false;
        }
      } else if (attrs[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

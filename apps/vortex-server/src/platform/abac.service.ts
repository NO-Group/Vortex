import type { Knex } from 'knex';

export interface ABACPolicy {
  id: string;
  name: string;
  table_name: string;
  action: string;
  attributes: Record<string, unknown>;
  condition: Record<string, unknown>;
  effect: 'allow' | 'deny';
  priority: number;
  enabled: boolean;
}

/**
 * ABACService — Attribute-Based Access Control.
 * Complements row-level security with fine-grained attribute conditions.
 */
export class ABACService {
  constructor(private readonly db: Knex) {}

  async create(policy: Omit<ABACPolicy, 'id'>): Promise<{ id: string }> {
    const [id] = await this.db('abac_policies').insert(policy);
    return { id: String(id) };
  }

  async list(tableName?: string) {
    if (tableName) {
      return this.db('abac_policies').where({ table_name: tableName }).orderBy('priority', 'desc');
    }
    return this.db('abac_policies').orderBy('priority', 'desc');
  }

  async update(id: string, patch: Partial<ABACPolicy>): Promise<number> {
    return this.db('abac_policies').where({ id }).update(patch);
  }

  async delete(id: string): Promise<number> {
    return this.db('abac_policies').where({ id }).del();
  }

  /**
   * Evaluate ABAC policies for a given request.
   * Returns the effective effect: deny if any deny policy matches,
   * allow if any allow policy matches, otherwise no policy matches.
   */
  async evaluate(
    tableName: string,
    action: string,
    subject: Record<string, unknown>,
    resource: Record<string, unknown>,
  ): Promise<'allow' | 'deny' | 'none'> {
    const policies = await this.db('abac_policies')
      .where({ table_name: tableName, action, enabled: true })
      .orderBy('priority', 'desc');

    for (const policy of policies) {
      const attrs = policy.attributes as Record<string, Record<string, unknown>>;
      const conditions = policy.condition as Record<string, unknown>;

      // Check if attributes match
      const attrMatch = this.matchAttributes(attrs, subject, resource, { action });
      if (!attrMatch) continue;

      // Check if condition evaluates true
      const condMatch = this.evalCondition(conditions, { ...subject, ...resource, action });
      if (!condMatch) continue;

      // Policy matches — return its effect
      return policy.effect as 'allow' | 'deny';
    }

    return 'none';
  }

  private matchAttributes(
    attrs: Record<string, Record<string, unknown>>,
    subject: Record<string, unknown>,
    resource: Record<string, unknown>,
    action: Record<string, unknown>,
  ): boolean {
    if (!attrs.subject) return true;
    for (const [key, value] of Object.entries(attrs.subject)) {
      if (subject[key] !== value) return false;
    }
    if (attrs.resource) {
      for (const [key, value] of Object.entries(attrs.resource)) {
        if (resource[key] !== value) return false;
      }
    }
    return true;
  }

  private evalCondition(cond: Record<string, unknown>, ctx: Record<string, unknown>): boolean {
    const op = cond.op as string;
    const left = cond.left;
    const right = cond.right;

    if (op === 'and') {
      return (cond.conditions as Array<Record<string, unknown>>)?.every((c) => this.evalCondition(c, ctx)) ?? true;
    }
    if (op === 'or') {
      return (cond.conditions as Array<Record<string, unknown>>)?.some((c) => this.evalCondition(c, ctx)) ?? false;
    }
    if (op === 'not') {
      return !this.evalCondition(cond.condition as Record<string, unknown>, ctx);
    }

    const leftVal = typeof left === 'string' && left.startsWith('$') ? ctx[left.slice(1)] : left;
    const rightVal = typeof right === 'string' && right.startsWith('$') ? ctx[right.slice(1)] : right;

    switch (op) {
      case 'eq': return leftVal === rightVal;
      case 'neq': return leftVal !== rightVal;
      case 'gt': return Number(leftVal) > Number(rightVal);
      case 'lt': return Number(leftVal) < Number(rightVal);
      case 'gte': return Number(leftVal) >= Number(rightVal);
      case 'lte': return Number(leftVal) <= Number(rightVal);
      case 'in': return Array.isArray(rightVal) && rightVal.includes(leftVal);
      case 'not_in': return Array.isArray(rightVal) && !rightVal.includes(leftVal);
      default: return true;
    }
  }
}

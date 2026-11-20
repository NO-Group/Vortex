import type { Knex } from 'knex';
import type { QueryPlan } from '@vortex/core';
import { ApiError } from '../errors.js';

/**
 * Query governance — measure every plan, refuse the expensive ones.
 *
 * Supabase has no cost ceiling: an accidental unindexed scan runs to
 * completion and shows up on the bill. Vortex asks Postgres what the planner
 * intends to do *before* executing, and can decline to run a query past an
 * operator-set cost ceiling — returning the measured cost so the caller can
 * fix it (usually: add the index the plan summary names).
 */

interface PlanNode {
  'Node Type'?: string;
  'Total Cost'?: number;
  'Plan Rows'?: number;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Join Type'?: string;
  'Filter'?: string;
  Plans?: PlanNode[];
}

/** Walk an EXPLAIN tree into indented human-readable lines. */
export function summarizePlan(node: PlanNode | undefined, depth = 0, out: string[] = []): string[] {
  if (!node) return out;

  const parts: string[] = [node['Node Type'] ?? '?'];
  if (node['Relation Name']) parts.push(`on ${node['Relation Name']}`);
  if (node['Index Name']) parts.push(`using ${node['Index Name']}`);
  if (node['Join Type']) parts.push(`(${node['Join Type']} join)`);

  const cost = node['Total Cost'] ?? 0;
  const rows = node['Plan Rows'] ?? 0;
  out.push(`${'· '.repeat(depth)}${parts.join(' ')}  [cost ${cost}, rows ${rows}]`);

  for (const child of node.Plans ?? []) summarizePlan(child, depth + 1, out);
  return out;
}

/** Pull the root node out of `EXPLAIN (FORMAT JSON)` output. */
export function extractPlan(raw: unknown): QueryPlan | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== 'object') return null;

  // FORMAT JSON yields either [{Plan: {...}}] or a bare node, depending on
  // driver parsing — accept both shapes.
  const root = (first as Record<string, unknown>)['Plan'] ?? first;
  if (!root || typeof root !== 'object') return null;

  const node = root as PlanNode;
  return {
    cost: typeof node['Total Cost'] === 'number' ? node['Total Cost'] : null,
    summary: summarizePlan(node),
  };
}

/**
 * Ask the planner about a query without running it.
 * Returns null when EXPLAIN can't be run — governance degrades to "allow"
 * rather than blocking traffic on an introspection failure.
 */
export async function explainQuery(
  db: Knex,
  sql: string,
  bindings: unknown[],
): Promise<QueryPlan | null> {
  try {
    const result = await db.raw(`EXPLAIN (FORMAT JSON) ${sql}`, bindings as never[]);
    const rows = result?.rows ?? [];
    return extractPlan(rows[0]?.['QUERY PLAN']);
  } catch {
    return null;
  }
}

export interface QueryLogEntry {
  tableName: string;
  action: string;
  sql: string;
  bindings: unknown[];
  cost: number | null;
  durationMs: number;
  userId: string | null;
  outcome: 'ok' | 'rejected';
}

export class QueryGovernor {
  constructor(
    private readonly db: Knex,
    private readonly opts: {
      /** Reject queries whose planned cost exceeds this. Undefined = no limit. */
      maxCost?: number;
      /** Log queries at or above this duration (ms). */
      slowQueryMs?: number;
    } = {},
  ) {}

  /** Cost ceiling, if governance is enforcing one. */
  get maxCost(): number | undefined {
    return this.opts.maxCost;
  }

  /** True when a ceiling is configured (EXPLAIN must run on every query). */
  get enforcing(): boolean {
    return this.opts.maxCost !== undefined;
  }

  /** Measure a query's plan before executing it. */
  measure(sql: string, bindings: unknown[]): Promise<QueryPlan | null> {
    return explainQuery(this.db, sql, bindings);
  }

  /** Throw when a plan breaches the configured ceiling. */
  enforce(plan: QueryPlan | null): void {
    if (!plan || this.opts.maxCost === undefined) return;
    if (plan.cost !== null && plan.cost > this.opts.maxCost) {
      throw ApiError.tooExpensive(plan.cost, this.opts.maxCost, { plan: plan.summary });
    }
  }

  /**
   * Persist slow / rejected queries for the insights view.
   * Best-effort: an audit-log failure must never break the request.
   */
  async record(entry: QueryLogEntry): Promise<void> {
    const slowThreshold = this.opts.slowQueryMs ?? 250;
    const worthKeeping = entry.outcome === 'rejected' || entry.durationMs >= slowThreshold;
    if (!worthKeeping) return;

    try {
      await this.db('vortex_query_log').insert({
        table_name: entry.tableName,
        action: entry.action,
        sql: entry.sql.slice(0, 8000),
        bindings: JSON.stringify(entry.bindings ?? []).slice(0, 8000),
        cost: entry.cost,
        duration_ms: entry.durationMs,
        user_id: entry.userId,
        outcome: entry.outcome,
      });
    } catch {
      // Audit logging is best-effort by design.
    }
  }
}

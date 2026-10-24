import type { Knex } from 'knex';
import type { QueryExplain, QueryFilter, QueryRequest, QueryResult } from '@vortex/core';
import { ApiError } from '../errors.js';
import type { VortexEventBus } from '../realtime/bus.js';
import type { RbacService } from './rbac.js';
import type { PolicyService } from '../policies/policy.service.js';
import { compileCheckPredicate } from '../policies/compiler.js';
import type { PolicyIdentity } from '@vortex/core';
import { explainQuery, type QueryGovernor } from '../governance/query-governor.js';

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Guard against SQL identifier injection through column/table names. */
export function assertIdentifier(name: string, kind: string): string {
  if (!IDENTIFIER.test(name)) {
    throw ApiError.badRequest(`Invalid ${kind} name: "${name}"`);
  }
  return name;
}

const OP_TO_SQL: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  ilike: 'ilike',
};

/** Loose query-builder alias for dynamic filter application. */
type AnyQuery = Knex.QueryBuilder<any, any>;

/** Apply one filter to a query builder (shared by AND / OR application). */
function applyFilter(query: AnyQuery, filter: QueryFilter): AnyQuery {
  assertIdentifier(filter.column, 'column');
  const op = filter.op ?? 'eq';

  if (op === 'in') {
    if (!Array.isArray(filter.value)) {
      throw ApiError.badRequest(`Filter "${filter.column}" with op "in" requires an array value`);
    }
    query.whereIn(filter.column, filter.value as any[]);
    return query;
  }

  if (op === 'is') {
    query.whereNull(filter.column);
    return query;
  }

  if (op === 'contains') {
    // JSONB containment: value may be an object/array or a scalar.
    query.whereRaw(`??::jsonb @> ?::jsonb`, [
      filter.column,
      JSON.stringify(filter.value ?? null),
    ]);
    return query;
  }

  query.where(filter.column, OP_TO_SQL[op] as string, filter.value as any);
  return query;
}

/** Build the WHERE clause for a dynamic query (pure helper, unit-tested). */
export function applyFilters(query: AnyQuery, filters: QueryFilter[] | undefined): AnyQuery {
  if (!filters?.length) return query;
  for (const filter of filters) {
    applyFilter(query, filter);
  }
  return query;
}

/**
 * Apply OR-groups: each group is AND-ed internally, groups are OR-ed.
 * (pure helper, unit-tested).
 */
export function applyOrGroups(query: AnyQuery, groups: QueryFilter[][] | undefined): AnyQuery {
  if (!groups?.length) return query;
  query.where((builder) => {
    for (const group of groups) {
      builder.orWhere((inner) => {
        for (const filter of group) {
          applyFilter(inner as AnyQuery, filter);
        }
      });
    }
  });
  return query;
}

export interface MutationActor {
  userId: string;
  role: string;
  email?: string | null;
  meta?: Record<string, unknown>;
}

/** Optional v0.7 collaborators (policies + cost governance). */
export interface QueryServiceExtras {
  policies?: PolicyService;
  governor?: QueryGovernor;
}

function identityOf(actor: MutationActor): PolicyIdentity {
  return {
    userId: actor.userId,
    role: actor.role,
    email: actor.email ?? null,
    meta: actor.meta ?? {},
  };
}

/**
 * Dynamic CRUD executor over PostgreSQL with JSONB support, role-based
 * access control, compiled row policies, and plan-level cost governance.
 * Every mutation is broadcast on the realtime bus for sub-50ms fan-out.
 */
export class QueryService {
  constructor(
    private readonly db: Knex,
    private readonly rbac: RbacService,
    private readonly bus: VortexEventBus,
    private readonly extras: QueryServiceExtras = {},
  ) {}

  /** Ask the planner what a query will cost (used for EXPLAIN + ceilings). */
  private async measure(sql: string, bindings: unknown[]): Promise<QueryExplain['plan'] | null> {
    if (this.extras.governor) return this.extras.governor.measure(sql, bindings);
    return explainQuery(this.db, sql, bindings);
  }

  /**
   * Evaluate a WITH CHECK predicate against a candidate row, standalone:
   * `select (<predicate>)` with the row's values bound in. Rejects the write
   * before the row ever reaches the table.
   */
  private async passesCheck(
    node: Parameters<typeof compileCheckPredicate>[0],
    identity: PolicyIdentity,
    row: Record<string, unknown>,
  ): Promise<boolean> {
    const compiled = compileCheckPredicate(node, identity, row);
    try {
      const result = await this.db.raw(`select (${compiled.sql}) as ok`, compiled.bindings as never[]);
      return result?.rows?.[0]?.ok === true;
    } catch {
      // An unevaluable predicate fails closed — the write is refused.
      return false;
    }
  }

  /** SELECT with filters / ordering / pagination / embeds / policies. */
  async select(actor: MutationActor, table: string, req: QueryRequest): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    const { ownerColumn } = await this.rbac.authorize({
      role: actor.role,
      userId: actor.userId,
      table,
      action: 'select',
    });

    const identity = identityOf(actor);
    const policies = this.extras.policies
      ? await this.extras.policies.compile({ table, action: 'select', identity })
      : null;

    const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(req.offset ?? 0, 0);

    const query = this.db(table).select(req.select?.map((c) => assertIdentifier(c, 'column')) ?? '*');
    applyFilters(query, req.filters);
    applyOrGroups(query, req.or);
    if (ownerColumn) query.where(ownerColumn, actor.userId);
    if (policies?.using) query.whereRaw(policies.using.sql, policies.using.bindings as never[]);

    for (const order of req.orderBy ?? []) {
      query.orderBy(assertIdentifier(order.column, 'column'), order.direction ?? 'asc');
    }

    const built = query.limit(limit).offset(offset);
    const started = Date.now();
    const wantPlan = req.explain === true || this.extras.governor?.enforcing === true;
    let explain: QueryExplain | undefined;

    try {
      if (wantPlan) {
        const { sql, bindings } = built.toSQL();
        const bound = [...(bindings ?? [])] as unknown[];
        const plan = await this.measure(sql, bound);
        this.extras.governor?.enforce(plan);
        if (req.explain) explain = { plan: plan ?? { cost: null, summary: [] }, sql, bindings: bound };
      }

      const rows = (await built) as Record<string, unknown>[];
      const durationMs = Date.now() - started;

      await this.extras.governor?.record({
        tableName: table,
        action: 'select',
        sql: wantPlan ? (explain?.sql ?? '') : '',
        bindings: wantPlan ? (explain?.bindings ?? []) : [],
        cost: explain?.plan.cost ?? null,
        durationMs,
        userId: actor.userId,
        outcome: 'ok',
      });

      let total: number | undefined;
      if (req.countTotal) {
        const countQuery = this.db(table).count<{ count: string }[]>({ count: '*' });
        applyFilters(countQuery, req.filters);
        applyOrGroups(countQuery, req.or);
        if (ownerColumn) countQuery.where(ownerColumn, actor.userId);
        if (policies?.using) {
          countQuery.whereRaw(policies.using.sql, policies.using.bindings as never[]);
        }
        const [row] = (await countQuery) as Array<{ count: string }>;
        total = Number(row?.count ?? 0);
      }

      if (req.include?.length && rows.length) {
        await this.attachIncludes(actor, rows, req.include);
      }

      const result: QueryResult =
        total === undefined ? { rows, count: rows.length } : { rows, count: rows.length, total };
      return explain ? { ...result, explain } : result;
    } catch (err) {
      await this.extras.governor?.record({
        tableName: table,
        action: 'select',
        sql: '',
        bindings: [],
        cost: null,
        durationMs: Date.now() - started,
        userId: actor.userId,
        outcome: 'rejected',
      });
      throw err;
    }
  }

  /** Batch-attach related rows under `include.as` (explicit joins). */
  private async attachIncludes(
    actor: MutationActor,
    rows: Record<string, unknown>[],
    includes: NonNullable<QueryRequest['include']>,
  ): Promise<void> {
    for (const inc of includes) {
      assertIdentifier(inc.table, 'table');
      assertIdentifier(inc.localKey, 'column');
      assertIdentifier(inc.foreignKey, 'column');
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inc.as)) {
        throw ApiError.badRequest(`Invalid include alias: "${inc.as}"`);
      }

      // Embeds are reads: the caller must be allowed to select the remote table.
      await this.rbac.authorize({
        role: actor.role,
        userId: actor.userId,
        table: inc.table,
        action: 'select',
      });

      const keys = [
        ...new Set(
          rows.map((r) => r[inc.localKey]).filter((v) => v !== null && v !== undefined),
        ),
      ];
      const related: Record<string, unknown>[] = keys.length
        ? ((await this.db(inc.table)
            .select(inc.select?.map((c) => assertIdentifier(c, 'column')) ?? '*')
            .whereIn(inc.foreignKey, keys as any[])) as Record<string, unknown>[])
        : [];

      // Attach as an array of matches (works for one-to-one and one-to-many).
      const byKey = new Map<unknown, Record<string, unknown>[]>();
      for (const rel of related) {
        const list = byKey.get(rel[inc.foreignKey]) ?? [];
        list.push(rel);
        byKey.set(rel[inc.foreignKey], list);
      }
      for (const row of rows) {
        row[inc.as] = byKey.get(row[inc.localKey]) ?? [];
      }
    }
  }

  /** INSERT one or more rows (each must include the owner column when scoped). */
  async insert(
    actor: MutationActor,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    if (!rows.length) throw ApiError.badRequest('Insert requires at least one row');

    const { ownerColumn } = await this.rbac.authorize({
      role: actor.role,
      userId: actor.userId,
      table,
      action: 'insert',
    });

    const identity = identityOf(actor);
    const policies = this.extras.policies
      ? await this.extras.policies.compile({ table, action: 'insert', identity })
      : null;

    const prepared = rows.map((row) => {
      const copy = { ...row };
      if (ownerColumn) copy[ownerColumn] = actor.userId;
      return copy;
    });

    // WITH CHECK runs before the write, on the exact row we're about to store.
    if (policies?.checkNodes.length) {
      for (const row of prepared) {
        for (const node of policies.checkNodes) {
          if (!(await this.passesCheck(node, identity, row))) {
            throw ApiError.forbidden('Row rejected by write policy (with check)');
          }
        }
      }
    }

    const inserted = (await this.db(table).insert(prepared).returning('*')) as Record<string, unknown>[];
    this.bus.emitTableChange({ table, action: 'INSERT', rows: inserted, actorId: actor.userId });
    return { rows: inserted, count: inserted.length };
  }

  /** UPDATE rows matching filters (owner-scoped + policy-scoped). */
  async update(
    actor: MutationActor,
    table: string,
    patch: Record<string, unknown>,
    filters: QueryFilter[],
  ): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    const { ownerColumn } = await this.rbac.authorize({
      role: actor.role,
      userId: actor.userId,
      table,
      action: 'update',
    });

    const identity = identityOf(actor);
    const policies = this.extras.policies
      ? await this.extras.policies.compile({ table, action: 'update', identity })
      : null;

    // WITH CHECK applies to the row as it will be *after* the patch, so read
    // the current rows first and evaluate the merged candidate.
    if (policies?.checkNodes.length) {
      const candidateQuery = this.db(table).select('*');
      applyFilters(candidateQuery, filters);
      if (ownerColumn) candidateQuery.where(ownerColumn, actor.userId);
      if (policies.using) {
        candidateQuery.whereRaw(policies.using.sql, policies.using.bindings as never[]);
      }

      const existing = (await candidateQuery) as Record<string, unknown>[];
      for (const row of existing) {
        const candidate = { ...row, ...patch };
        for (const node of policies.checkNodes) {
          if (!(await this.passesCheck(node, identity, candidate))) {
            throw ApiError.forbidden('Update rejected by write policy (with check)');
          }
        }
      }
    }

    const query = this.db(table);
    applyFilters(query, filters);
    if (ownerColumn) query.where(ownerColumn, actor.userId);
    if (policies?.using) query.whereRaw(policies.using.sql, policies.using.bindings as never[]);

    const updated = (await query.update(patch).returning('*')) as Record<string, unknown>[];
    if (updated.length) {
      this.bus.emitTableChange({ table, action: 'UPDATE', rows: updated, actorId: actor.userId });
    }
    return { rows: updated, count: updated.length };
  }

  /** DELETE rows matching filters (owner-scoped + policy-scoped). */
  async delete(
    actor: MutationActor,
    table: string,
    filters: QueryFilter[],
  ): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    if (!filters.length) {
      throw ApiError.badRequest('Delete requires at least one filter (refusing to truncate)');
    }

    const { ownerColumn } = await this.rbac.authorize({
      role: actor.role,
      userId: actor.userId,
      table,
      action: 'delete',
    });

    const identity = identityOf(actor);
    const policies = this.extras.policies
      ? await this.extras.policies.compile({ table, action: 'delete', identity })
      : null;

    const query = this.db(table);
    applyFilters(query, filters);
    if (ownerColumn) query.where(ownerColumn, actor.userId);
    if (policies?.using) query.whereRaw(policies.using.sql, policies.using.bindings as never[]);

    const deleted = (await query.delete().returning('*')) as Record<string, unknown>[];
    if (deleted.length) {
      this.bus.emitTableChange({ table, action: 'DELETE', rows: deleted, actorId: actor.userId });
    }
    return { rows: deleted, count: deleted.length };
  }
}

import type { Knex } from 'knex';
import type { QueryFilter, QueryRequest, QueryResult } from '@vortex/core';
import { ApiError } from '../errors.js';
import type { VortexEventBus } from '../realtime/bus.js';
import type { RbacService } from './rbac.js';

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
}

/**
 * Dynamic CRUD executor over PostgreSQL with JSONB support and
 * role-based access control. Every mutation is broadcast on the
 * realtime bus for sub-50ms fan-out to subscribed sockets.
 */
export class QueryService {
  constructor(
    private readonly db: Knex,
    private readonly rbac: RbacService,
    private readonly bus: VortexEventBus,
  ) {}

  /** SELECT with filters / ordering / pagination / embeds. */
  async select(actor: MutationActor, table: string, req: QueryRequest): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    const { ownerColumn } = await this.rbac.authorize({
      role: actor.role,
      userId: actor.userId,
      table,
      action: 'select',
    });

    const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(req.offset ?? 0, 0);

    const query = this.db(table).select(req.select?.map((c) => assertIdentifier(c, 'column')) ?? '*');
    applyFilters(query, req.filters);
    applyOrGroups(query, req.or);
    if (ownerColumn) query.where(ownerColumn, actor.userId);

    for (const order of req.orderBy ?? []) {
      query.orderBy(assertIdentifier(order.column, 'column'), order.direction ?? 'asc');
    }

    const rows = (await query.limit(limit).offset(offset)) as Record<string, unknown>[];

    let total: number | undefined;
    if (req.countTotal) {
      const countQuery = this.db(table).count<{ count: string }[]>({ count: '*' });
      applyFilters(countQuery, req.filters);
      applyOrGroups(countQuery, req.or);
      if (ownerColumn) countQuery.where(ownerColumn, actor.userId);
      const [row] = (await countQuery) as Array<{ count: string }>;
      total = Number(row?.count ?? 0);
    }

    if (req.include?.length && rows.length) {
      await this.attachIncludes(actor, rows, req.include);
    }

    return total === undefined ? { rows, count: rows.length } : { rows, count: rows.length, total };
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

    const prepared = rows.map((row) => {
      const copy = { ...row };
      if (ownerColumn) copy[ownerColumn] = actor.userId;
      return copy;
    });

    const inserted = (await this.db(table).insert(prepared).returning('*')) as Record<string, unknown>[];
    this.bus.emitTableChange({ table, action: 'INSERT', rows: inserted, actorId: actor.userId });
    return { rows: inserted, count: inserted.length };
  }

  /** UPDATE rows matching filters (owner-scoped when required). */
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

    const query = this.db(table);
    applyFilters(query, filters);
    if (ownerColumn) query.where(ownerColumn, actor.userId);

    const updated = (await query.update(patch).returning('*')) as Record<string, unknown>[];
    if (updated.length) {
      this.bus.emitTableChange({ table, action: 'UPDATE', rows: updated, actorId: actor.userId });
    }
    return { rows: updated, count: updated.length };
  }

  /** DELETE rows matching filters (owner-scoped when required). */
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

    const query = this.db(table);
    applyFilters(query, filters);
    if (ownerColumn) query.where(ownerColumn, actor.userId);

    const deleted = (await query.delete().returning('*')) as Record<string, unknown>[];
    if (deleted.length) {
      this.bus.emitTableChange({ table, action: 'DELETE', rows: deleted, actorId: actor.userId });
    }
    return { rows: deleted, count: deleted.length };
  }
}

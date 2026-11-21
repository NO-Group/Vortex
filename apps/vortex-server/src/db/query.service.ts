/**
 * Vortex Server — Database Query Service: dynamic CRUD over PostgreSQL.
 */

import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import { RbacService } from './rbac.service.js';
import type { MutationActor, QueryFilter, QueryResult } from '@vortex/core';

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdentifier(name: string, kind = 'identifier'): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw ApiError.badRequest(`Invalid ${kind}: "${name}"`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

function applyFilters(query: AnyQuery, filters: QueryFilter[]): void {
  for (const f of filters) {
    assertIdentifier(f.column, 'column');
    switch (f.op) {
      case 'eq':
        query.where(f.column, '=', f.value);
        break;
      case 'neq':
        query.where(f.column, '<>', f.value);
        break;
      case 'gt':
        query.where(f.column, '>', f.value);
        break;
      case 'gte':
        query.where(f.column, '>=', f.value);
        break;
      case 'lt':
        query.where(f.column, '<', f.value);
        break;
      case 'lte':
        query.where(f.column, '<=', f.value);
        break;
      case 'like':
        query.where(f.column, 'ILIKE', `%${f.value}%`);
        break;
      case 'in':
        query.whereIn(f.column, f.value as unknown[]);
        break;
    }
  }
}

export class QueryService {
  constructor(
    private db: Knex,
    private rbac: RbacService,
  ) {}

  /** SELECT rows from a table with optional filters, pagination, and ordering. */
  async select(actor: MutationActor, table: string, opts: {
    filters?: QueryFilter[];
    limit?: number;
    offset?: number;
    orderBy?: { column: string; direction: 'asc' | 'desc' };
  } = {}): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    await this.rbac.authorize(actor, table, 'select');

    let query = this.db(table).select('*');
    if (opts.filters) applyFilters(query, opts.filters);

    if (opts.orderBy) {
      assertIdentifier(opts.orderBy.column, 'column');
      query = query.orderBy(opts.orderBy.column, opts.orderBy.direction);
    }

    if (opts.limit !== undefined) {
      query = query.limit(Math.min(Math.max(opts.limit, 1), 1000));
    }
    if (opts.offset !== undefined) {
      query = query.offset(Math.max(opts.offset, 0));
    }

    const rows = (await query) as Record<string, unknown>[];
    return { rows, count: rows.length, total: undefined };
  }

  /** INSERT one or more rows. */
  async insert(actor: MutationActor, table: string, rows: Record<string, unknown>[]): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    if (!rows.length) throw ApiError.badRequest('Insert requires at least one row');
    await this.rbac.authorize(actor, table, 'insert');

    const inserted = (await this.db(table).insert(rows).returning('*')) as Record<string, unknown>[];
    return { rows: inserted, count: inserted.length };
  }

  /** UPDATE rows matching filters. */
  async update(actor: MutationActor, table: string, filters: QueryFilter[], patch: Record<string, unknown>): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    if (!filters.length) throw ApiError.badRequest('Update requires at least one filter (refusing to update all rows)');
    await this.rbac.authorize(actor, table, 'update');

    const query = this.db(table).update(patch).returning('*');
    applyFilters(query, filters);

    const updated = (await query) as Record<string, unknown>[];
    return { rows: updated, count: updated.length };
  }

  /** DELETE rows matching filters. */
  async delete(actor: MutationActor, table: string, filters: QueryFilter[]): Promise<QueryResult> {
    assertIdentifier(table, 'table');
    if (!filters.length) throw ApiError.badRequest('Delete requires at least one filter (refusing to truncate)');
    await this.rbac.authorize(actor, table, 'delete');

    const query = this.db(table).delete().returning('*');
    applyFilters(query, filters);

    const deleted = (await query) as Record<string, unknown>[];
    return { rows: deleted, count: deleted.length };
  }
}

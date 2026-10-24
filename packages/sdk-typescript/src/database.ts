import type { HttpClient } from './http.js';
import type { FilterOp } from './types.js';
import type {
  QueryRequest, QueryResult, QueryFilter,
} from './types.js';

/**
 * Vortex Database — dynamic CRUD with filters, OR-groups, embeds,
 * row policies, and plan-level cost governance.
 *
 * ```ts
 * const result = await vortex.database
 *   .from('notes')
 *   .select(['id', 'title', 'body'])
 *   .filter('owner_id', 'eq', userId)
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .execute();
 * ```
 */
export class Database {
  constructor(private readonly http: HttpClient) {}

  /** Start building a query on a table. */
  from(table: string): QueryBuilder {
    return new QueryBuilder(this.http, table);
  }

  /** Raw dynamic query (escape hatch for full control). */
  async query<T = Record<string, unknown>>(
    table: string,
    req: QueryRequest,
  ): Promise<QueryResult<T>> {
    return this.http.request<QueryResult<T>>(`/v1/db/${table}/query`, {
      method: 'POST',
      body: req,
    });
  }

  /** Insert one or more rows. */
  async insert(
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<QueryResult> {
    return this.http.request<QueryResult>(`/v1/db/${table}`, {
      method: 'POST',
      body: { rows },
    });
  }

  /**
   * Upsert rows — insert or update on conflict.
   *
   * Uses ON CONFLICT DO UPDATE SET — the row is updated if it already
   * exists (matching the conflict target), otherwise inserted.
   *
   * ```ts
   * await vortex.database.upsert('notes', [
   *   { id: '1', title: 'Hello', owner_id: userId },
   * ], ['id']);
   * ```
   */
  async upsert(
    table: string,
    rows: Record<string, unknown>[],
    conflictKeys: string[],
    patch?: Record<string, unknown>,
  ): Promise<QueryResult> {
    return this.http.request<QueryResult>(`/v1/db/${table}/upsert`, {
      method: 'POST',
      body: { rows, conflictKeys, patch },
    });
  }

  /** Update rows matching filters. */
  async update(
    table: string,
    patch: Record<string, unknown>,
    filters: QueryFilter[],
  ): Promise<QueryResult> {
    return this.http.request<QueryResult>(`/v1/db/${table}`, {
      method: 'PATCH',
      body: { patch, filters },
    });
  }

  /** Delete rows matching filters. */
  async delete(
    table: string,
    filters: QueryFilter[],
  ): Promise<QueryResult> {
    return this.http.request<QueryResult>(`/v1/db/${table}`, {
      method: 'DELETE',
      body: { filters },
    });
  }

  /** List non-system table names. */
  async tables(): Promise<string[]> {
    const { tables } = await this.http.request<{ tables: string[] }>('/v1/db/tables');
    return tables;
  }

  /** Count rows matching filters. */
  async count(
    table: string,
    filters?: QueryFilter[],
  ): Promise<number> {
    const result = await this.http.request<QueryResult>(`/v1/db/${table}/query`, {
      method: 'POST',
      body: { select: ['id'], filters, countTotal: true, limit: 1 },
    });
    return result.total ?? 0;
  }
}

/**
 * Fluent query builder. Chain filters, ordering, pagination, embeds,
 * and policies, then `.execute()`.
 */
export class QueryBuilder {
  private selectCols: string[] | undefined;
  private filters: QueryFilter[] = [];
  private orGroups: QueryFilter[][] = [];
  private orderCols: Array<{ column: string; direction: 'asc' | 'desc' }> = [];
  private includeList: import('./types.js').QueryInclude[] = [];
  private limitVal: number | undefined;
  private offsetVal: number | undefined;
  private countTotalVal: boolean = false;
  private explainVal: boolean = false;

  constructor(
    private readonly http: HttpClient,
    private readonly table: string,
  ) {}

  /** Choose which columns to return (default: all). */
  select(columns: string[]): this {
    this.selectCols = columns;
    return this;
  }

  /** Add a single filter. */
  filter(column: string, op: FilterOp, value: unknown): this {
    this.filters.push({ column, op, value });
    return this;
  }

  /** Add an OR-group (each group is AND-ed internally, groups are OR-ed). */
  or(groups: QueryFilter[][]): this {
    this.orGroups.push(...groups);
    return this;
  }

  /** Order by a column. */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderCols.push({ column, direction });
    return this;
  }

  /** Limit the number of rows. */
  limit(n: number): this {
    this.limitVal = Math.min(n, 500);
    return this;
  }

  /** Skip N rows (use with limit for pagination). */
  offset(n: number): this {
    this.offsetVal = Math.max(n, 0);
    return this;
  }

  /** Attach related rows from another table. */
  include(include: NonNullable<QueryRequest['include']>[number]): this {
    this.includeList.push(include);
    return this;
  }

  /** Return the total count of matching rows (ignores limit/offset). */
  countTotal(): this {
    this.countTotalVal = true;
    return this;
  }

  /** Return the planner's cost + plan summary alongside the rows. */
  explain(): this {
    this.explainVal = true;
    return this;
  }

  /** Execute the query. */
  async execute<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const req: QueryRequest = {
      ...(this.selectCols?.length ? { select: this.selectCols } : {}),
      ...(this.filters.length ? { filters: this.filters } : {}),
      ...(this.orGroups.length ? { or: this.orGroups } : {}),
      ...(this.orderCols.length ? { orderBy: this.orderCols } : {}),
      ...(this.includeList?.length ? { include: this.includeList } : {}),
      ...(this.limitVal !== undefined ? { limit: this.limitVal } : {}),
      ...(this.offsetVal !== undefined ? { offset: this.offsetVal } : {}),
      ...(this.countTotalVal ? { countTotal: true } : {}),
      ...(this.explainVal ? { explain: true } : {}),
    };

    return this.http.request<QueryResult<T>>(`/v1/db/${this.table}/query`, {
      method: 'POST',
      body: req,
    });
  }
}

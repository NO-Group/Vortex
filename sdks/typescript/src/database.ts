import { HttpClient } from './http.js';

export interface QueryFilter {
  column: string;
  op?: string;
  value?: unknown;
}

export class QueryBuilder {
  private filters: QueryFilter[] = [];
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private orderByVal: Array<{ column: string; direction: string }> = [];
  private countTotalFlag = false;

  constructor(private readonly http: HttpClient, private readonly table: string) {}

  select(cols?: string[]): this {
    this._select = cols;
    return this;
  }
  private _select?: string[];

  filter(column: string, op: string, value: unknown): this {
    this.filters.push({ column, op, value });
    return this;
  }

  limit(n: number): this { this.limitVal = n; return this; }
  offset(n: number): this { this.offsetVal = n; return this; }
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByVal.push({ column, direction });
    return this;
  }
  countTotal(): this { this.countTotalFlag = true; return this; }

  async execute(): Promise<{ rows: unknown[]; count: number; total?: number }> {
    const body: Record<string, unknown> = {
      filters: this.filters,
      countTotal: this.countTotalFlag,
    };
    if (this._select) body.select = this._select;
    if (this.limitVal !== null) body.limit = this.limitVal;
    if (this.offsetVal !== null) body.offset = this.offsetVal;
    if (this.orderByVal.length) body.orderBy = this.orderByVal;
    return this.http.request(`/v1/db/${this.table}/query`, { method: 'POST', body });
  }
}

export class Database {
  constructor(private readonly http: HttpClient) {}

  from(table: string): QueryBuilder {
    return new QueryBuilder(this.http, table);
  }

  async insert(table: string, rows: unknown[]): Promise<{ rows: unknown[]; count: number }> {
    return this.http.request(`/v1/db/${table}`, { method: 'POST', body: { rows } });
  }

  async update(table: string, updates: Record<string, unknown>, filters: QueryFilter[]): Promise<{ count: number }> {
    return this.http.request(`/v1/db/${table}`, { method: 'PATCH', body: { updates, filters } });
  }

  async delete(table: string, filters: QueryFilter[]): Promise<{ count: number }> {
    return this.http.request(`/v1/db/${table}`, { method: 'DELETE', body: { filters } });
  }

  async listTables(): Promise<{ tables: string[] }> {
    return this.http.request('/v1/db/tables');
  }
}

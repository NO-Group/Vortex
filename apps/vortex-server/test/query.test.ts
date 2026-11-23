import { describe, expect, it, vi } from 'vitest';
import { applyFilters, assertIdentifier } from '../src/db/query.service.js';
import { ApiError } from '../src/errors.js';

/** Minimal query-builder stub capturing where-clauses. */
function stubQuery() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query = {
    where: (...args: unknown[]) => {
      calls.push({ method: 'where', args });
      return query;
    },
    whereIn: (...args: unknown[]) => {
      calls.push({ method: 'whereIn', args });
      return query;
    },
    whereNull: (...args: unknown[]) => {
      calls.push({ method: 'whereNull', args });
      return query;
    },
  };
  return { query: query as never, calls };
}

describe('assertIdentifier', () => {
  it('accepts safe identifiers', () => {
    expect(assertIdentifier('notes', 'table')).toBe('notes');
    expect(assertIdentifier('owner_id', 'column')).toBe('owner_id');
  });

  it('rejects injection attempts', () => {
    expect(() => assertIdentifier('users; DROP TABLE users', 'table')).toThrow(ApiError);
    expect(() => assertIdentifier('col name', 'column')).toThrow(ApiError);
    expect(() => assertIdentifier('1col', 'column')).toThrow(ApiError);
    expect(() => assertIdentifier('', 'column')).toThrow(ApiError);
  });
});

describe('applyFilters', () => {
  it('translates operators to SQL clauses', () => {
    const { query, calls } = stubQuery();
    applyFilters(query, [
      { column: 'title', op: 'like', value: '%vortex%' },
      { column: 'score', op: 'gte', value: 10 },
    ]);
    expect(calls[0]).toEqual({ method: 'where', args: ['title', 'like', '%vortex%'] });
    expect(calls[1]).toEqual({ method: 'where', args: ['score', '>=', 10] });
  });

  it('defaults to equality', () => {
    const { query, calls } = stubQuery();
    applyFilters(query, [{ column: 'id', value: 42 }]);
    expect(calls[0]).toEqual({ method: 'where', args: ['id', '=', 42] });
  });

  it('uses whereIn for array ops and whereNull for is', () => {
    const { query, calls } = stubQuery();
    applyFilters(query, [
      { column: 'id', op: 'in', value: [1, 2, 3] },
      { column: 'deleted_at', op: 'is', value: null },
    ]);
    expect(calls[0]).toEqual({ method: 'whereIn', args: ['id', [1, 2, 3]] });
    expect(calls[1]).toEqual({ method: 'whereNull', args: ['deleted_at'] });
  });

  it('rejects "in" filters without arrays', () => {
    const { query } = stubQuery();
    expect(() => applyFilters(query, [{ column: 'id', op: 'in', value: 5 }])).toThrow(ApiError);
  });

  it('rejects unsafe column names', () => {
    const { query } = stubQuery();
    expect(() => applyFilters(query, [{ column: 'id = 1 OR 1', value: 1 }])).toThrow(ApiError);
  });
});

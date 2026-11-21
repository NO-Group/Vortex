import { describe, expect, it } from 'vitest';
import {
  compilePredicate,
  compileCheckPredicate,
  isPolicyGroup,
  resolveValueRef,
  PolicyCompileError,
} from '../src/policies/compiler.js';
import { EventBacklog } from '../src/realtime/backlog.js';
import { extractPlan, summarizePlan, QueryGovernor } from '../src/governance/query-governor.js';
import { renderNaivePredicate } from '../src/policies/policies.routes.js';
import type { PolicyIdentity } from '@vortex/core';

const identity: PolicyIdentity = {
  userId: 'u-111',
  role: 'user',
  email: 'sensei@no.group',
  meta: { org: 'n-o' },
};

describe('policy compiler — identity is bound once, never per row', () => {
  it('resolves user.id to a literal binding (no function call in the SQL)', () => {
    const compiled = compilePredicate({ column: 'owner_id', valueRef: 'user.id' }, identity);

    expect(compiled.sql).toBe('"owner_id" = ?');
    expect(compiled.bindings).toEqual(['u-111']);

    // The whole point: nothing that Postgres must evaluate per row.
    expect(compiled.sql).not.toMatch(/auth\.uid|current_setting|current_user/i);
  });

  it('renders the per-row equivalent it replaces, for comparison', () => {
    const naive = renderNaivePredicate({ column: 'owner_id', valueRef: 'user.id' });
    expect(naive).toBe('owner_id = auth.uid()');

    const vortex = compilePredicate({ column: 'owner_id', valueRef: 'user.id' }, identity);
    expect(vortex.sql).not.toContain('auth.uid()');
  });

  it('resolves role, email, custom claims and now', () => {
    expect(resolveValueRef('user.role', identity)).toBe('user');
    expect(resolveValueRef('user.email', identity)).toBe('sensei@no.group');
    expect(resolveValueRef('user.meta.org', identity)).toBe('n-o');
    expect(resolveValueRef('user.meta.missing', identity)).toBeNull();
    expect(typeof resolveValueRef('now', identity)).toBe('string');
  });

  it('throws on unknown refs', () => {
    expect(() => resolveValueRef('user.ssn' as 'user.id', identity)).toThrow(PolicyCompileError);
  });

  it('compiles nested and/or/not groups', () => {
    const compiled = compilePredicate(
      {
        or: [
          { column: 'owner_id', valueRef: 'user.id' },
          {
            and: [
              { column: 'public', value: true },
              { not: { column: 'archived', value: true } },
            ],
          },
        ],
      },
      identity,
    );

    expect(compiled.sql).toBe('("owner_id" = ?) or (("public" = ?) and (not ("archived" = ?)))');
    expect(compiled.bindings).toEqual(['u-111', true, true]);
  });

  it('supports in / is / contains', () => {
    expect(compilePredicate({ column: 'status', op: 'in', value: ['a', 'b'] }, identity).sql).toBe(
      '"status" in (?, ?)',
    );
    expect(compilePredicate({ column: 'deleted_at', op: 'is' }, identity)).toEqual({
      sql: '"deleted_at" is null',
      bindings: [],
    });
    expect(compilePredicate({ column: 'body', op: 'contains', value: { tag: 'x' } }, identity)).toEqual({
      sql: '"body"::jsonb @> ?::jsonb',
      bindings: ['{"tag":"x"}'],
    });
  });

  it('refuses unsafe column names and operators', () => {
    expect(() => compilePredicate({ column: 'id; drop table users' }, identity)).toThrow(
      PolicyCompileError,
    );
    expect(() => compilePredicate({ column: 'id', op: 'exec' as 'eq' }, identity)).toThrow(
      PolicyCompileError,
    );
  });

  it('narrows group nodes', () => {
    expect(isPolicyGroup({ and: [] })).toBe(true);
    expect(isPolicyGroup({ column: 'a' })).toBe(false);
  });
});

describe('with check — validated against a candidate row, before the write', () => {
  it('binds the candidate row values on the column side', () => {
    const compiled = compileCheckPredicate(
      { column: 'owner_id', valueRef: 'user.id' },
      identity,
      { owner_id: 'u-111' },
    );

    // Standalone-evaluable: `select (? = ?)` with both sides bound.
    expect(compiled.sql).toBe('? = ?');
    expect(compiled.bindings).toEqual(['u-111', 'u-111']);
  });

  it('catches a row that violates the policy', () => {
    const compiled = compileCheckPredicate(
      { column: 'owner_id', valueRef: 'user.id' },
      identity,
      { owner_id: 'someone-else' },
    );
    expect(compiled.bindings[0]).not.toBe(compiled.bindings[1]);
  });
});

describe('event backlog — realtime that survives a disconnect', () => {
  const base = {
    type: 'vortex:event' as const,
    id: 'e1',
    action: 'INSERT' as const,
    table: 'notes',
    rows: [],
    actorId: null,
    timestamp: new Date().toISOString(),
  };

  it('stamps monotonic sequence numbers per channel', () => {
    const backlog = new EventBacklog(10);
    expect(backlog.push('table:notes', base).seq).toBe(1);
    expect(backlog.push('table:notes', base).seq).toBe(2);
    expect(backlog.push('table:tasks', base).seq).toBe(1);
    expect(backlog.cursor('table:notes')).toBe(2);
  });

  it('replays only what was missed', () => {
    const backlog = new EventBacklog(10);
    for (let i = 0; i < 5; i += 1) backlog.push('table:notes', base);

    expect(backlog.since('table:notes', 0).map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(backlog.since('table:notes', 3).map((e) => e.seq)).toEqual([4, 5]);
    expect(backlog.since('table:notes', 5)).toEqual([]);
  });

  it('flags a truncated window instead of hiding the gap', () => {
    const backlog = new EventBacklog(3);
    for (let i = 0; i < 10; i += 1) backlog.push('table:notes', base);

    // Events 1..10 pushed, only 8..10 retained; asking from 0 lost history.
    expect(backlog.isTruncated('table:notes', 0)).toBe(true);
    // Asking from the oldest retained seq is fully covered.
    expect(backlog.isTruncated('table:notes', 7)).toBe(false);
  });

  it('evicts oldest events beyond the configured depth', () => {
    const backlog = new EventBacklog(2);
    for (let i = 0; i < 5; i += 1) backlog.push('table:notes', base);
    expect(backlog.since('table:notes', 0).map((e) => e.seq)).toEqual([4, 5]);
  });
});

describe('query governance — plans are measured, expensive ones refused', () => {
  it('summarizes a plan tree with indentation', () => {
    const lines = summarizePlan({
      'Node Type': 'Hash Join',
      'Total Cost': 120.5,
      'Plan Rows': 400,
      'Join Type': 'Inner',
      Plans: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'notes', 'Total Cost': 40, 'Plan Rows': 100 }],
    });

    expect(lines[0]).toContain('Hash Join');
    expect(lines[0]).toContain('(Inner join)');
    expect(lines[1]).toContain('Seq Scan on notes');
  });

  it('extracts root cost from EXPLAIN (FORMAT JSON) output', () => {
    const plan = extractPlan([
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'notes',
          'Total Cost': 25.5,
          'Plan Rows': 100,
        },
        'Planning Time': 0.2,
      },
    ]);

    expect(plan?.cost).toBe(25.5);
    expect(plan?.summary[0]).toContain('Seq Scan on notes');
  });

  it('returns null for unparseable output', () => {
    expect(extractPlan(undefined)).toBeNull();
    expect(extractPlan('nonsense')).toBeNull();
  });

  it('rejects queries over the ceiling and allows those under it', () => {
    const governor = new QueryGovernor({} as never, { maxCost: 10 });

    expect(() => governor.enforce({ cost: 42, summary: [] })).toThrow(/exceeds the configured ceiling/);
    expect(() => governor.enforce({ cost: 9, summary: [] })).not.toThrow();
    // No plan measured ⇒ never blocks (governance degrades to allow).
    expect(() => governor.enforce(null)).not.toThrow();
  });

  it('only enforces when a ceiling is configured', () => {
    const open = new QueryGovernor({} as never, {});
    expect(open.enforcing).toBe(false);
    expect(() => open.enforce({ cost: 1e9, summary: [] })).not.toThrow();

    const capped = new QueryGovernor({} as never, { maxCost: 10 });
    expect(capped.enforcing).toBe(true);
  });
});

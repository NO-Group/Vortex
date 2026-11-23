import type {
  CompiledPredicate,
  FilterOp,
  PolicyIdentity,
  PolicyNode,
  PolicyPredicate,
  PolicyPredicateGroup,
  PolicyValueRef,
} from '@vortex/core';

/**
 * Policy compiler.
 *
 * This is the heart of the advantage over Supabase's row policies.
 *
 * Supabase emits `owner_id = auth.uid()` into every row policy. Postgres
 * treats `auth.uid()` as a per-row function call: it cannot constant-fold
 * it, cardinality estimates collapse, and index usage degrades. Their own
 * performance guide tells you to wrap it as `owner_id = (select auth.uid())`
 * by hand — a footgun every new user hits once and never forgets.
 *
 * Vortex never emits a function call. `valueRef: 'user.id'` is resolved to
 * a literal ONCE, at compile time, and bound as a query parameter:
 *
 *   Supabase:  owner_id = auth.uid()                    ← evaluated per row
 *   Vortex:    "owner_id" = $3   with binding [7f3e…]   ← constant, indexable
 *
 * Same semantics, planner-visible constant, no footgun to remember.
 *
 * Two compilation modes share the same engine:
 *   USING      — the column side stays a column reference (`"owner_id"`)
 *   WITH CHECK — the column side becomes a bound literal from the candidate
 *                row, so the predicate can be evaluated standalone as
 *                `select (<predicate>)` before any write happens.
 */

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

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

export class PolicyCompileError extends Error {}

/** Narrow a policy node to a boolean group. */
export function isPolicyGroup(node: PolicyNode): node is PolicyPredicateGroup {
  return (
    typeof node === 'object' &&
    node !== null &&
    ('and' in node || 'or' in node || 'not' in node)
  );
}

/** Resolve an identity reference to a literal — called ONCE per query. */
export function resolveValueRef(ref: PolicyValueRef, identity: PolicyIdentity): unknown {
  switch (ref) {
    case 'user.id':
      return identity.userId;
    case 'user.role':
      return identity.role;
    case 'user.email':
      return identity.email;
    case 'now':
      return new Date().toISOString();
    default: {
      const prefix = 'user.meta.';
      if (ref.startsWith(prefix)) {
        const key = ref.slice(prefix.length);
        return identity.meta?.[key] ?? null;
      }
      throw new PolicyCompileError(`Unknown policy value ref: "${ref}"`);
    }
  }
}

/**
 * How the column side of a comparison is emitted.
 * `sql` is text safe to inline (identifiers are strictly validated);
 * `binding` (when present) is pushed ahead of the comparison value.
 */
interface ColumnTarget {
  sql: string;
  binding?: unknown;
}

type ColumnResolver = (column: string) => ColumnTarget;

/** USING mode: keep the column as a quoted identifier. */
const quotedColumn: ColumnResolver = (column) => ({ sql: `"${column}"` });

/** WITH CHECK mode: bind the candidate row's value for that column. */
function rowColumn(row: Record<string, unknown>): ColumnResolver {
  return (column) => ({ sql: '?', binding: row[column] ?? null });
}

function compileLeaf(
  predicate: PolicyPredicate,
  identity: PolicyIdentity,
  resolve: ColumnResolver,
): CompiledPredicate {
  if (!IDENTIFIER.test(predicate.column)) {
    throw new PolicyCompileError(`Invalid policy column: "${predicate.column}"`);
  }

  const op: FilterOp = predicate.op ?? 'eq';
  const value =
    predicate.valueRef !== undefined
      ? resolveValueRef(predicate.valueRef, identity)
      : (predicate.value ?? null);

  const col = resolve(predicate.column);
  const head: unknown[] = col.binding !== undefined ? [col.binding] : [];

  // `is` (null check) needs no comparison value at all.
  if (op === 'is') {
    return { sql: `${col.sql} is null`, bindings: head };
  }

  if (op === 'in') {
    const list = Array.isArray(value) ? value : [value];
    if (!list.length) return { sql: 'false', bindings: [] };
    const holes = list.map(() => '?').join(', ');
    return { sql: `${col.sql} in (${holes})`, bindings: [...head, ...list] };
  }

  if (op === 'contains') {
    return {
      sql: `${col.sql}::jsonb @> ?::jsonb`,
      bindings: [...head, JSON.stringify(value ?? null)],
    };
  }

  const sqlOp = OP_TO_SQL[op];
  if (!sqlOp) {
    throw new PolicyCompileError(`Unsupported policy operator: "${op}"`);
  }

  // The payoff line: `value` is a literal here, never a function call.
  return { sql: `${col.sql} ${sqlOp} ?`, bindings: [...head, value] };
}

/**
 * Compile a policy expression into one parameterized SQL fragment.
 * Groups combine with AND; empty groups compile to `true`.
 */
function compileNode(
  node: PolicyNode,
  identity: PolicyIdentity,
  resolve: ColumnResolver,
): CompiledPredicate {
  if (!isPolicyGroup(node)) return compileLeaf(node, identity, resolve);

  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (node.and?.length) {
    const inner = node.and.map((n) => compileNode(n, identity, resolve));
    clauses.push(inner.map((c) => `(${c.sql})`).join(' and '));
    for (const c of inner) bindings.push(...c.bindings);
  }

  if (node.or?.length) {
    const inner = node.or.map((n) => compileNode(n, identity, resolve));
    clauses.push(inner.map((c) => `(${c.sql})`).join(' or '));
    for (const c of inner) bindings.push(...c.bindings);
  }

  if (node.not) {
    const inner = compileNode(node.not, identity, resolve);
    clauses.push(`not (${inner.sql})`);
    bindings.push(...inner.bindings);
  }

  if (!clauses.length) return { sql: 'true', bindings: [] };
  return { sql: clauses.join(' and '), bindings };
}

/** Compile a USING predicate (column references stay column references). */
export function compilePredicate(node: PolicyNode, identity: PolicyIdentity): CompiledPredicate {
  return compileNode(node, identity, quotedColumn);
}

/**
 * Compile a WITH CHECK predicate against a candidate row: the column side is
 * bound from the row, so the result can be evaluated standalone with
 * `select (<sql>)` — before the row is ever written.
 */
export function compileCheckPredicate(
  node: PolicyNode,
  identity: PolicyIdentity,
  row: Record<string, unknown>,
): CompiledPredicate {
  return compileNode(node, identity, rowColumn(row));
}

/** Does a policy apply to this role? `roles: ['*']` matches every role. */
export function policyAppliesToRole(roles: string[], role: string): boolean {
  return roles.includes('*') || roles.includes(role);
}

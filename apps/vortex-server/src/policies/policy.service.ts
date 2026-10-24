import type { Knex } from 'knex';
import type {
  CompiledPredicate,
  PermissionAction,
  PolicyIdentity,
  PolicyNode,
  VortexPolicy,
} from '@vortex/core';
import { ApiError } from '../errors.js';
import { compilePredicate, policyAppliesToRole, PolicyCompileError } from './compiler.js';

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const ACTIONS: PermissionAction[] = ['select', 'insert', 'update', 'delete'];

interface PolicyRow {
  id: string;
  name: string;
  table_name: string;
  action: string;
  roles: string[];
  using_expr: PolicyNode;
  check_expr: PolicyNode | null;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

/** AND several compiled predicates into one. */
export function combinePredicates(parts: CompiledPredicate[]): CompiledPredicate | null {
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0]!;
  return {
    sql: parts.map((p) => `(${p.sql})`).join(' and '),
    bindings: parts.flatMap((p) => p.bindings),
  };
}

export interface CompiledPolicies {
  /** USING — which existing rows the caller may see / affect. */
  using: CompiledPredicate | null;
  /** WITH CHECK — which new rows the caller may write. */
  withCheck: CompiledPredicate | null;
  /**
   * Source nodes behind `withCheck`. A CHECK must be evaluated against a
   * candidate row (its column side becomes a bound literal), so the consumer
   * recompiles per row rather than reusing the USING-mode SQL.
   */
  checkNodes: PolicyNode[];
}

/**
 * Row policies as data.
 *
 * Supabase stores policies as Postgres DDL (`CREATE POLICY … USING (…)`) —
 * they live in the database, need migrations to change, are invisible to the
 * API layer, and (see compiler.ts) evaluate identity per row.
 *
 * Vortex policies are rows in a table: readable, writable and diffable over
 * the API, compileable to a single bound predicate, and — crucially —
 * inspectable. You can ask Vortex exactly what SQL your policy produced
 * before it ever touches your data.
 */
export class PolicyService {
  constructor(private readonly db: Knex) {}

  private toPolicy(row: PolicyRow): VortexPolicy {
    return {
      id: row.id,
      name: row.name,
      tableName: row.table_name,
      action: row.action as PermissionAction,
      roles: row.roles ?? [],
      using: row.using_expr,
      withCheck: row.check_expr ?? null,
      enabled: row.enabled,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  /** Compile a policy expression against a dummy identity to prove it's valid. */
  private assertCompilable(node: PolicyNode, label: string): void {
    try {
      compilePredicate(node, { userId: null, role: 'user', email: null, meta: {} });
    } catch (err) {
      throw ApiError.badRequest(
        `Invalid ${label} policy expression: ${
          err instanceof PolicyCompileError ? err.message : 'malformed'
        }`,
      );
    }
  }

  async list(tableName?: string): Promise<VortexPolicy[]> {
    const query = this.db<PolicyRow>('vortex_policies').orderBy('created_at', 'asc');
    if (tableName) query.where({ table_name: tableName });
    return (await query).map((r) => this.toPolicy(r));
  }

  async get(id: string): Promise<VortexPolicy> {
    const row = await this.db<PolicyRow>('vortex_policies').where({ id }).first();
    if (!row) throw ApiError.notFound(`Policy "${id}" not found`);
    return this.toPolicy(row);
  }

  async create(input: {
    name: string;
    tableName: string;
    action: PermissionAction;
    roles: string[];
    using: PolicyNode;
    withCheck?: PolicyNode | null;
    enabled?: boolean;
  }): Promise<VortexPolicy> {
    if (!input.name?.trim()) throw ApiError.badRequest('Policy name is required');
    if (!IDENTIFIER.test(input.tableName)) {
      throw ApiError.badRequest(`Invalid table name: "${input.tableName}"`);
    }
    if (!ACTIONS.includes(input.action)) {
      throw ApiError.badRequest(`Invalid action: "${input.action}"`);
    }
    if (!input.roles?.length) throw ApiError.badRequest('At least one role is required');

    this.assertCompilable(input.using, 'using');
    if (input.withCheck) this.assertCompilable(input.withCheck, 'with_check');

    const [row] = (await this.db<PolicyRow>('vortex_policies')
      .insert({
        name: input.name.trim(),
        table_name: input.tableName,
        action: input.action,
        roles: input.roles,
        using_expr: input.using,
        check_expr: input.withCheck ?? null,
        enabled: input.enabled ?? true,
      })
      .returning('*')) as PolicyRow[];

    if (!row) throw new ApiError(500, 'internal', 'Policy could not be created');
    return this.toPolicy(row);
  }

  async update(
    id: string,
    patch: Partial<{
      name: string;
      action: PermissionAction;
      roles: string[];
      using: PolicyNode;
      withCheck: PolicyNode | null;
      enabled: boolean;
    }>,
  ): Promise<VortexPolicy> {
    const existing = await this.get(id);

    const next = {
      name: patch.name?.trim() || existing.name,
      action: patch.action ?? existing.action,
      roles: patch.roles ?? existing.roles,
      using: patch.using ?? existing.using,
      withCheck: patch.withCheck !== undefined ? patch.withCheck : existing.withCheck,
      enabled: patch.enabled ?? existing.enabled,
    };

    if (!ACTIONS.includes(next.action)) {
      throw ApiError.badRequest(`Invalid action: "${next.action}"`);
    }
    this.assertCompilable(next.using, 'using');
    if (next.withCheck) this.assertCompilable(next.withCheck, 'with_check');

    const [row] = (await this.db<PolicyRow>('vortex_policies')
      .where({ id })
      .update({
        name: next.name,
        action: next.action,
        roles: next.roles,
        using_expr: next.using,
        check_expr: next.withCheck ?? null,
        enabled: next.enabled,
        updated_at: this.db.fn.now(),
      })
      .returning('*')) as PolicyRow[];

    if (!row) throw ApiError.notFound(`Policy "${id}" not found`);
    return this.toPolicy(row);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db('vortex_policies').where({ id }).delete();
    if (!deleted) throw ApiError.notFound(`Policy "${id}" not found`);
  }

  /**
   * Compile every policy that applies to (table, action, role) into one
   * predicate pair. Admins bypass policies entirely, matching RBAC.
   */
  async compile(input: {
    table: string;
    action: PermissionAction;
    identity: PolicyIdentity;
  }): Promise<CompiledPolicies> {
    if (input.identity.role === 'admin') {
      return { using: null, withCheck: null, checkNodes: [] };
    }

    const rows = (await this.db<PolicyRow>('vortex_policies')
      .where({ table_name: input.table, action: input.action, enabled: true })) as PolicyRow[];

    const applicable = rows.filter((r) => policyAppliesToRole(r.roles ?? [], input.identity.role));
    if (!applicable.length) return { using: null, withCheck: null, checkNodes: [] };

    const using: CompiledPredicate[] = [];
    const withCheck: CompiledPredicate[] = [];
    const checkNodes: PolicyNode[] = [];

    for (const row of applicable) {
      using.push(compilePredicate(row.using_expr, input.identity));

      // No explicit WITH CHECK means "reuse USING" — the documented default.
      const checkExpr = row.check_expr ?? row.using_expr;
      withCheck.push(compilePredicate(checkExpr, input.identity));
      checkNodes.push(checkExpr);
    }

    return {
      using: combinePredicates(using),
      withCheck: combinePredicates(withCheck),
      checkNodes,
    };
  }

  /**
   * Preview the SQL a policy produces for a hypothetical caller.
   * Lets an operator confirm "identity is bound once, not called per row"
   * without reading source.
   */
  async explain(input: {
    table: string;
    action: PermissionAction;
    identity: PolicyIdentity;
  }): Promise<{
    using: CompiledPredicate | null;
    withCheck: CompiledPredicate | null;
    matches: number;
  }> {
    const compiled = await this.compile(input);
    const rows = (await this.db<PolicyRow>('vortex_policies')
      .where({ table_name: input.table, action: input.action, enabled: true })) as PolicyRow[];
    const matches = rows.filter((r) =>
      policyAppliesToRole(r.roles ?? [], input.identity.role),
    ).length;
    return { using: compiled.using, withCheck: compiled.withCheck, matches };
  }
}

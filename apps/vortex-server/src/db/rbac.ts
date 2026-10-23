import type { Knex } from 'knex';
import type { PermissionAction, RoleName, TablePermission } from '@vortex/core';
import { ApiError } from '../errors.js';

/** Tables that must never be mutated by non-admin callers via /v1/db. */
export const SYSTEM_TABLES = new Set([
  'users',
  'table_permissions',
  'storage_objects',
  'apps',
  'app_files',
]);

interface PermissionRow {
  role: string;
  table_name: string;
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  owner_column: string | null;
}

function toTablePermission(row: PermissionRow): TablePermission {
  return {
    role: row.role,
    tableName: row.table_name,
    canSelect: row.can_select,
    canInsert: row.can_insert,
    canUpdate: row.can_update,
    canDelete: row.can_delete,
    ownerColumn: row.owner_column,
  };
}

export interface AccessDecision {
  allowed: boolean;
  /**
   * When set, the query must be scoped to rows where this column equals the
   * caller's user id (owner-based row-level security).
   */
  ownerColumn: string | null;
  /** Human-readable denial reason (for audit logs / error messages). */
  reason?: string;
}

/**
 * Pure RBAC decision function — easy to unit-test without a database.
 *
 * Rules:
 *  1. `admin` role gets full access, unscoped.
 *  2. A matching permission row is required (role + table, or role + `*`).
 *  3. The action flag (canSelect/canInsert/...) must be enabled.
 *  4. If `ownerColumn` is set, non-admin callers are row-scoped to their id.
 */
export function decideAccess(
  perms: TablePermission[],
  role: RoleName,
  table: string,
  action: PermissionAction,
  _userId: string,
): AccessDecision {
  if (role === 'admin') {
    return { allowed: true, ownerColumn: null };
  }

  const perm =
    perms.find((p) => p.tableName === table && p.role === role) ??
    perms.find((p) => p.tableName === '*' && p.role === role);

  if (!perm) {
    return { allowed: false, ownerColumn: null, reason: `role "${role}" has no grant on "${table}"` };
  }

  const flag = {
    select: perm.canSelect,
    insert: perm.canInsert,
    update: perm.canUpdate,
    delete: perm.canDelete,
  }[action];

  if (!flag) {
    return { allowed: false, ownerColumn: null, reason: `role "${role}" cannot ${action} on "${table}"` };
  }

  return { allowed: true, ownerColumn: perm.ownerColumn };
}

export class RbacService {
  constructor(private readonly db: Knex) {}

  /** Load all grants for a role (including wildcard rows). */
  async permissionsFor(role: RoleName): Promise<TablePermission[]> {
    const rows = await this.db<PermissionRow>('table_permissions')
      .where({ role })
      .orWhere({ table_name: '*' });
    return rows.map(toTablePermission);
  }

  /**
   * Resolve and enforce access for a caller.
   * Throws ApiError(403) when denied; returns the owner scope otherwise.
   */
  async authorize(input: {
    role: RoleName;
    userId: string;
    table: string;
    action: PermissionAction;
  }): Promise<{ ownerColumn: string | null }> {
    if (SYSTEM_TABLES.has(input.table) && input.role !== 'admin') {
      // System tables still honor explicit grants (e.g. users may select
      // their own storage_objects rows) — fall through to normal resolution,
      // but never allow insert/update on them except for admins.
      if (input.action === 'insert' || input.action === 'update') {
        throw ApiError.forbidden(`Table "${input.table}" is system-managed`);
      }
    }

    const perms = await this.permissionsFor(input.role);
    const decision = decideAccess(perms, input.role, input.table, input.action, input.userId);
    if (!decision.allowed) {
      throw ApiError.forbidden(decision.reason ?? 'Access denied');
    }
    return { ownerColumn: decision.ownerColumn };
  }
}

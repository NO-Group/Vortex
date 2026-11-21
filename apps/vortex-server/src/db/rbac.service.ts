/**
 * Vortex Server — RBAC service: role-based access control for table operations.
 */

import type { Knex } from 'knex';
import type { MutationActor, UserRole } from '@vortex/core';
import { ApiError } from '../errors.js';

export interface RbacPolicy {
  table: string;
  roles: UserRole[];
  actions: ('select' | 'insert' | 'update' | 'delete')[];
}

/** Default RBAC policy: admins get everything, developers get full CRUD, viewers get read-only. */
const DEFAULT_POLICY: RbacPolicy[] = [
  { table: '*', roles: ['admin'], actions: ['select', 'insert', 'update', 'delete'] },
  { table: '*', roles: ['developer'], actions: ['select', 'insert', 'update', 'delete'] },
  { table: '*', roles: ['viewer'], actions: ['select'] },
];

export class RbacService {
  private policies: RbacPolicy[] = [...DEFAULT_POLICY];

  constructor(private db: Knex) {}

  /** Authorize an action on a table, returning the owner column name if the table is owner-scoped. */
  async authorize(actor: MutationActor, table: string, action: 'select' | 'insert' | 'update' | 'delete'): Promise<{ ownerColumn: string | null }> {
    const applicable = this.policies.find(
      (p) => (p.table === '*' || p.table === table) && p.roles.includes(actor.role),
    );

    if (!applicable || !applicable.actions.includes(action)) {
      throw ApiError.forbidden(`Role '${actor.role}' cannot ${action} on table '${table}'`);
    }

    return { ownerColumn: null };
  }
}

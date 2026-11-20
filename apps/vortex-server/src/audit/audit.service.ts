import type { Knex } from 'knex';

export interface AuditEntry {
  id: string;
  user_id: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
}

export interface AuditService {
  record(entry: {
    userId: string;
    role: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  list(opts: {
    userId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEntry[]>;
  stats(userId: string): Promise<{
    totalActions: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
    lastActive: string | null;
  }>;
}

export function createAuditService(db: Knex): AuditService {
  return {
    async record(entry) {
      await db('vortex_audit_log').insert({
        user_id: entry.userId,
        role: entry.role,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        metadata: entry.metadata ?? null,
      });
    },

    async list({ userId, action, limit = 50, offset = 0 }) {
      const query = db('vortex_audit_log')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (userId) query.where('user_id', userId);
      if (action) query.where('action', action);

      return query;
    },

    async stats(userId) {
      const total = await db('vortex_audit_log')
        .where('user_id', userId)
        .count({ count: '*' })
        .first();

      const byActionRows = await db('vortex_audit_log')
        .select('action', db.raw('count(*) as count'))
        .where('user_id', userId)
        .groupBy('action');

      const byResourceRows = await db('vortex_audit_log')
        .select('resource_type', db.raw('count(*) as count'))
        .where('user_id', userId)
        .groupBy('resource_type');

      const lastRow = await db('vortex_audit_log')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .first();

      const byAction: Record<string, number> = {};
      for (const row of byActionRows) {
        byAction[row.action] = Number(row.count);
      }

      const byResource: Record<string, number> = {};
      for (const row of byResourceRows) {
        byResource[row.resource_type] = Number(row.count);
      }

      return {
        totalActions: Number(total?.count ?? 0),
        byAction,
        byResource,
        lastActive: lastRow ? String(lastRow.created_at) : null,
      };
    },
  };
}

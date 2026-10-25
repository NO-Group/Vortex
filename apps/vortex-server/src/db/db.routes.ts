import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { RbacService } from './rbac.js';
import { QueryService } from './query.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import { ApiError } from '../errors.js';
import type { TokenConfig } from '../auth/tokens.js';

let webhookService: WebhookService | null = null;

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

/** Deliver a webhook event (fire-and-forget, errors are logged). */
async function deliverWebhook(
  ctx: AppContext,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await getWebhookService(ctx).deliver(event, data);
  } catch {
    // Webhook delivery failures must never break the request
  }
}

const filterSchema = z.object({
  column: z.string().min(1),
  op: z
    .enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'contains'])
    .optional(),
  value: z.unknown(),
});

const orderSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).optional(),
});

const includeSchema = z.object({
  table: z.string().min(1),
  localKey: z.string().min(1),
  foreignKey: z.string().min(1),
  as: z.string().min(1),
  select: z.array(z.string().min(1)).optional(),
});

const querySchema = z.object({
  select: z.array(z.string().min(1)).optional(),
  filters: z.array(filterSchema).optional(),
  or: z.array(z.array(filterSchema)).optional(),
  orderBy: z.array(orderSchema).optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
  include: z.array(includeSchema).max(8).optional(),
  countTotal: z.boolean().optional(),
  /** Return the planner's cost + plan summary alongside the rows. */
  explain: z.boolean().optional(),
});

const insertSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(200),
});

const upsertSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(200),
  conflictKeys: z.array(z.string().min(1)).min(1),
  patch: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  patch: z.record(z.unknown()),
  filters: z.array(filterSchema).min(1),
});

const deleteSchema = z.object({
  filters: z.array(filterSchema).min(1),
});

const createTableSchema = z.object({
  columns: z.array(z.object({
    name: z.string().min(1).max(63),
    type: z.enum(['text', 'jsonb', 'integer', 'boolean', 'timestamptz']),
    required: z.boolean().optional(),
  })).min(1).max(30),
});

export function createDbRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  // v0.7: queries run through compiled row policies and, when a cost ceiling
  // is configured, are EXPLAINed before they're allowed to execute.
  const service = new QueryService(ctx.db, new RbacService(ctx.db), ctx.bus, {
    policies: ctx.policies,
    governor: ctx.governor,
  });

  const actorOf = (req: {
    auth?: { sub: string; role: string; email?: string; meta?: Record<string, unknown> };
  }) => ({
    userId: req.auth!.sub,
    role: req.auth!.role,
    email: req.auth!.email ?? null,
    meta: req.auth!.meta ?? {},
  });

  /** POST /v1/db/:table/query — run a dynamic SELECT. */
  router.post('/:table/query', auth, validateBody(querySchema), async (req, res, next) => {
    try {
      const result = await service.select(actorOf(req), req.params.table!, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/:table — insert rows. */
  router.post('/:table', auth, validateBody(insertSchema), async (req, res, next) => {
    try {
      const result = await service.insert(actorOf(req), req.params.table!, req.body.rows);
      void deliverWebhook(ctx, 'database.insert', {
        table: req.params.table,
        rows: result.rows,
        count: result.count,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/:table/upsert — insert or update on conflict. */
  router.post('/:table/upsert', auth, validateBody(upsertSchema), async (req, res, next) => {
    try {
      const result = await service.upsert(
        actorOf(req),
        req.params.table!,
        req.body.rows,
        req.body.conflictKeys,
        req.body.patch,
      );
      void deliverWebhook(ctx, 'database.upsert', {
        table: req.params.table,
        rows: result.rows,
        count: result.count,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/db/:table — update rows matching filters. */
  router.patch('/:table', auth, validateBody(updateSchema), async (req, res, next) => {
    try {
      const result = await service.update(
        actorOf(req),
        req.params.table!,
        req.body.patch,
        req.body.filters,
      );
      void deliverWebhook(ctx, 'database.update', {
        table: req.params.table,
        rows: result.rows,
        count: result.count,
        patch: req.body.patch,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/db/:table — delete rows matching filters. */
  router.delete('/:table', auth, validateBody(deleteSchema), async (req, res, next) => {
    try {
      const result = await service.delete(actorOf(req), req.params.table!, req.body.filters);
      void deliverWebhook(ctx, 'database.delete', {
        table: req.params.table,
        count: result.count,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/db/tables — list non-system table names (for policy UIs). */
  router.get('/tables', auth, async (_req, res, next) => {
    try {
      const rows = await ctx.db<{ table_name: string }>('information_schema.tables')
        .select('table_name')
        .whereRaw("table_schema = 'public' AND table_type = 'BASE TABLE'")
        .whereNotIn('table_name', [
          'users',
          'table_permissions',
          'storage_objects',
          'apps',
          'app_files',
          'auth_tokens',
          'buckets',
          'functions',
          'vortex_policies',
          'vortex_query_log',
        ])
        .orderBy('table_name');

      res.json({ tables: rows.map((r) => r.table_name) });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/:table/create — create a table with a custom schema. */
  router.post('/:table/create', auth, validateBody(createTableSchema), async (req, res, next) => {
    try {
      const table = req.params.table!;
      if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
        throw ApiError.badRequest('Table name must be a valid identifier');
      }

      // Build the column definitions.
      const colDefs = [
        'id uuid primary key default gen_random_uuid()',
        'owner_id uuid',
        'created_at timestamptz default now()',
        'updated_at timestamptz default now()',
      ];

      for (const col of req.body.columns) {
        const type = col.type === 'jsonb' ? 'jsonb'
          : col.type === 'integer' ? 'integer'
          : col.type === 'boolean' ? 'boolean'
          : col.type === 'timestamptz' ? 'timestamptz'
          : 'text';
        const nullable = col.required ? 'not null' : 'default null';
        colDefs.push(`${col.name} ${type} ${nullable}`);
      }

      const sql = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${colDefs.join(',\n  ')}\n)`;
      await ctx.db.raw(sql);

      // Create an index on owner_id for efficient owner-scoped queries.
      await ctx.db.raw(`CREATE INDEX IF NOT EXISTS "idx_${table}_owner" ON "${table}" (owner_id)`);

      res.status(201).json({ table, columns: req.body.columns, created: true });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/db/:table/schema — get column definitions for a table. */
  router.get('/:table/schema', auth, async (req, res, next) => {
    try {
      const table = req.params.table!;
      const rows = await ctx.db.raw<{
        rows: Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
        }>;
      }>(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table],
      );

      const columns = rows.rows.map((r) => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        defaultValue: r.column_default,
      }));

      res.json({ table, columns });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

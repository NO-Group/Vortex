import { Router } from 'express';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../errors.js';
import type { TokenConfig } from '../auth/tokens.js';

/** Insights are operator-facing: admin only. */
function adminOnly(req: { auth?: { role?: string } }, _res: unknown, next: (e?: unknown) => void): void {
  if (req.auth?.role !== 'admin') {
    next(ApiError.forbidden('Insights require the admin role'));
    return;
  }
  next();
}

/**
 * Query insights — the visibility Supabase reserves for paid tiers.
 * Every governed or slow query is measured and recorded, so an operator can
 * see exactly which table is scanning, what the planner cost, and which
 * queries were refused by the cost ceiling.
 */
export function createInsightsRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /** GET /v1/insights/queries?limit=50 — recent slow / refused queries. */
  router.get('/queries', auth, adminOnly, async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const rows = await ctx.db('vortex_query_log')
        .select('id', 'table_name', 'action', 'sql', 'cost', 'duration_ms', 'user_id', 'outcome', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(limit);

      res.json({
        queries: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          table: r.table_name,
          action: r.action,
          sql: r.sql,
          cost: r.cost,
          durationMs: r.duration_ms,
          userId: r.user_id,
          outcome: r.outcome,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/insights/overview — aggregates over the last hour. */
  router.get('/overview', auth, adminOnly, async (_req, res, next) => {
    try {
      const [row] = await ctx.db('vortex_query_log')
        .select(
          ctx.db.raw('count(*)::int as total'),
          ctx.db.raw('coalesce(avg(duration_ms), 0)::float as avg_duration_ms'),
          ctx.db.raw('coalesce(max(duration_ms), 0)::float as max_duration_ms'),
          ctx.db.raw('coalesce(max(cost), 0)::float as max_cost'),
          ctx.db.raw("count(*) filter (where outcome = 'rejected')::int as rejected"),
        )
        .whereRaw("created_at > now() - interval '1 hour'");

      res.json({
        window: '1 hour',
        total: Number(row?.total ?? 0),
        avgDurationMs: Number(row?.avg_duration_ms ?? 0),
        maxDurationMs: Number(row?.max_duration_ms ?? 0),
        maxCost: Number(row?.max_cost ?? 0),
        rejected: Number(row?.rejected ?? 0),
        ceiling: ctx.env.maxQueryCost ?? null,
        slowQueryMs: ctx.env.slowQueryMs,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

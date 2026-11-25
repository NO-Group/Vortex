import { Router } from 'express';
import { z } from 'zod';
import type { PolicyNode } from '@vortex/core';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import type { TokenConfig } from '../auth/tokens.js';

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'contains'] as const;

const predicateSchema = z.object({
  column: z.string().min(1),
  op: z.enum(OPS).optional(),
  value: z.unknown().optional(),
  valueRef: z.string().min(1).optional(),
});

/** Recursive policy expression: a leaf predicate or a boolean group. */
const policyNodeSchema: z.ZodType<PolicyNode> = z.lazy(() =>
  z.union([
    predicateSchema,
    z.object({
      and: z.array(policyNodeSchema).optional(),
      or: z.array(policyNodeSchema).optional(),
      not: policyNodeSchema.optional(),
    }),
  ]),
) as z.ZodType<PolicyNode>;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  tableName: z.string().min(1).max(120),
  action: z.enum(['select', 'insert', 'update', 'delete']),
  roles: z.array(z.string().min(1)).min(1),
  using: policyNodeSchema,
  withCheck: policyNodeSchema.nullable().optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial().omit({ tableName: true });

const previewSchema = z.object({
  tableName: z.string().min(1).max(120),
  action: z.enum(['select', 'insert', 'update', 'delete']),
  role: z.string().min(1).default('user'),
  userId: z.string().min(1).optional(),
  meta: z.record(z.unknown()).optional(),
});

const OPS_SQL: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'ILIKE',
};

/**
 * Render a policy the way a per-row row-security system would: identity as
 * a function call inside the predicate. Shown next to Vortex's compiled
 * output so the difference is impossible to miss.
 */
export function renderNaivePredicate(node: PolicyNode): string {
  if ('and' in node || 'or' in node || 'not' in node) {
    const group = node as { and?: PolicyNode[]; or?: PolicyNode[]; not?: PolicyNode };
    const parts: string[] = [];
    if (group.and?.length) parts.push(group.and.map((n) => `(${renderNaivePredicate(n)})`).join(' AND '));
    if (group.or?.length) parts.push(group.or.map((n) => `(${renderNaivePredicate(n)})`).join(' OR '));
    if (group.not) parts.push(`NOT (${renderNaivePredicate(group.not)})`);
    return parts.join(' AND ');
  }

  const leaf = node as { column: string; op?: string; value?: unknown; valueRef?: string };
  const op = OPS_SQL[leaf.op ?? 'eq'] ?? '=';

  let rendered: string;
  if (leaf.valueRef === 'user.id') rendered = 'auth.uid()';
  else if (leaf.valueRef === 'user.role') rendered = 'auth.role()';
  else if (leaf.valueRef === 'user.email') rendered = 'auth.jwt() ->> \'email\'';
  else if (leaf.valueRef) rendered = leaf.valueRef;
  else rendered = JSON.stringify(leaf.value ?? null);

  if (leaf.op === 'is') return `${leaf.column} IS NULL`;
  return `${leaf.column} ${op} ${rendered}`;
}

/** Does this policy reference caller identity at all? */
function usesIdentity(node: PolicyNode): boolean {
  if ('and' in node || 'or' in node || 'not' in node) {
    const group = node as { and?: PolicyNode[]; or?: PolicyNode[]; not?: PolicyNode };
    return [
      ...(group.and ?? []),
      ...(group.or ?? []),
      ...(group.not ? [group.not] : []),
    ].some(usesIdentity);
  }
  return Boolean((node as { valueRef?: string }).valueRef);
}

/** Policies are operator-controlled: admin only. */
function adminOnly(req: { auth?: { role?: string } }, _res: unknown, next: (e?: unknown) => void): void {
  if (req.auth?.role !== 'admin') {
    next(ApiError.forbidden('Policy management requires the admin role'));
    return;
  }
  next();
}

export function createPolicyRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /** GET /v1/policies?table=notes — list policies. */
  router.get('/', auth, adminOnly, async (req, res, next) => {
    try {
      const table = typeof req.query.table === 'string' ? req.query.table : undefined;
      res.json({ policies: await ctx.policies.list(table) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /v1/policies/preview — compile a policy set for a hypothetical
   * caller and show the SQL it produces. Lets an operator verify that
   * identity is bound once (not called per row) before enabling anything.
   */
  router.post('/preview', auth, adminOnly, validateBody(previewSchema), async (req, res, next) => {
    try {
      const { tableName, action, role, userId, meta } = req.body;
      const identity = {
        userId: userId ?? '00000000-0000-4000-8000-000000000000',
        role,
        email: 'preview@vortex.local',
        meta: meta ?? {},
      };

      const compiled = await ctx.policies.explain({ table: tableName, action, identity });
      const all = await ctx.policies.list(tableName);
      const applicable = all.filter(
        (p) => p.enabled && p.action === action && (p.roles.includes('*') || p.roles.includes(role)),
      );

      const usesId = applicable.some((p) => usesIdentity(p.using));

      res.json({
        table: tableName,
        action,
        role,
        matchedPolicies: compiled.matches,
        using: compiled.using,
        withCheck: compiled.withCheck,
        notes: [
          compiled.using
            ? 'Identity references are resolved to literals at compile time and bound as parameters — the planner sees a constant and can use an index.'
            : 'No policy applies to this role/action, so no predicate is attached.',
        ],
        ...(usesId
          ? {
              comparison: {
                vortex: compiled.using?.sql
                  ? `${compiled.using.sql}   -- bindings: ${JSON.stringify(compiled.using.bindings)}`
                  : null,
                perRowEquivalent: applicable.map((p) => renderNaivePredicate(p.using)).join(' AND '),
                whyItMatters:
                  'The per-row form calls auth.uid() for every candidate row: no constant folding, degraded cardinality estimates, index usage lost. Vortex binds the value once.',
              },
            }
          : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/policies — create a policy. */
  router.post('/', auth, adminOnly, validateBody(createSchema), async (req, res, next) => {
    try {
      res.status(201).json({ policy: await ctx.policies.create(req.body) });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/policies/:id — update a policy. */
  router.patch('/:id', auth, adminOnly, validateBody(updateSchema), async (req, res, next) => {
    try {
      res.json({ policy: await ctx.policies.update(req.params.id!, req.body) });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/policies/:id — remove a policy. */
  router.delete('/:id', auth, adminOnly, async (req, res, next) => {
    try {
      await ctx.policies.remove(req.params.id!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

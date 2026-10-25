import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { verifyToken, type TokenConfig } from '../auth/tokens.js';
import { QueryService } from '../db/query.service.js';
import { RbacService } from '../db/rbac.js';
import { FunctionsService } from './functions.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import {
  compileFunction,
  runFunction,
  FunctionCompileError,
  FunctionTimeoutError,
  type FnSandboxGlobals,
} from './runtime.js';
import type { FunctionRequest } from './functions.types.js';

let webhookService: WebhookService | null = null;

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

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

const createSchema = z.object({
  name: z.string().min(1).max(40),
  source: z.string().min(1).max(200_000),
  title: z.string().max(120).optional(),
});

const patchSchema = z.object({
  source: z.string().min(1).max(200_000).optional(),
  title: z.string().max(120).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

/** Management API — `/v1/functions`. */
export function createFunctionsRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new FunctionsService(ctx.db);

  /** POST /v1/functions — deploy a function. */
  router.post('/', auth, validateBody(createSchema), async (req, res, next) => {
    try {
      const fn = await service.create(
        req.auth!.sub,
        req.body.name,
        req.body.source,
        req.body.title,
      );
      void deliverWebhook(ctx, 'functions.deploy', {
        function: { name: fn.name, title: fn.title, status: fn.status },
      });
      res.status(201).json({ function: fn });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/functions — list my functions. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const functions = await service.list(req.auth!.sub, req.auth!.role === 'admin');
      res.json({ functions });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/functions/:name — details incl. source. */
  router.get('/:name', auth, async (req, res, next) => {
    try {
      const row = await service.requireOwned(
        req.params.name!,
        req.auth!.sub,
        req.auth!.role === 'admin',
      );
      res.json({
        function: {
          id: row.id,
          name: row.name,
          title: row.title,
          status: row.status,
          ownerId: row.owner_id,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        },
        source: row.source,
      });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/functions/:name — update source/title/status. */
  router.patch('/:name', auth, validateBody(patchSchema), async (req, res, next) => {
    try {
      const fn = await service.update(
        req.params.name!,
        req.auth!.sub,
        req.auth!.role === 'admin',
        req.body,
      );
      res.json({ function: fn });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/functions/:name — remove a function. */
  router.delete('/:name', auth, async (req, res, next) => {
    try {
      await service.remove(req.params.name!, req.auth!.sub, req.auth!.role === 'admin');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

const FUNCTION_TIMEOUT_MS = 5_000;

/** Public invocation — `ALL /functions/:name` (no auth required). */
export function createPublicFunctionRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new FunctionsService(ctx.db);
  const queryService = new QueryService(ctx.db, new RbacService(ctx.db), ctx.bus);

  router.all('/:name', async (req, res, next) => {
    try {
      const row = await service.getForInvoke(String(req.params.name ?? ''));
      if (!row || row.status !== 'active') {
        throw ApiError.notFound('Function not found');
      }

      // Optional caller identity — anonymous invocations are allowed.
      let user: FunctionRequest['user'] = null;
      const header = req.header('authorization') ?? '';
      const alt = req.header('x-vortex-token') ?? '';
      const rawToken = header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : alt || null;
      if (rawToken) {
        try {
          const claims = verifyToken(rawToken, ctx.env.jwt as TokenConfig);
          user = { sub: claims.sub, role: claims.role, email: claims.email, meta: claims.meta };
        } catch {
          user = null;
        }
      }

      const query: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') query[k] = v;
      }

      const fnRequest: FunctionRequest = {
        method: req.method,
        path: req.path,
        query,
        headers: {
          'content-type': req.header('content-type') ?? '',
          'user-agent': req.header('user-agent') ?? '',
        },
        body: req.body ?? null,
        user,
      };

      // Service-level (admin-scoped) helpers — functions are operator code.
      const serviceActor = { userId: user?.sub ?? row.owner_id ?? 'system', role: 'admin' };
      const sandboxGlobals: FnSandboxGlobals = {
        data: {
          query: (table, q = {}) => queryService.select(serviceActor, table, q as never),
          insert: (table, rows) => queryService.insert(serviceActor, table, rows),
          update: (table, patch, filters = []) =>
            queryService.update(serviceActor, table, patch, filters as never),
          delete: (table, filters) => queryService.delete(serviceActor, table, filters as never),
        },
        storage: {
          get: async (key) => {
            const object = await ctx.storage.get(key);
            return { size: object.size, contentType: object.contentType, body: object.body.toString('base64') };
          },
          put: async (key, body, contentType = 'text/plain') => {
            const result = await ctx.storage.put({
              key,
              body: Buffer.from(body, 'utf8'),
              contentType,
            });
            return { key: result.key, size: result.size };
          },
          list: async (prefix = '') => {
            const keys = await ctx.storage.list(prefix, 1000);
            return keys.map((key) => ({ key }));
          },
        },
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([k]) => k.startsWith('VORTEX_FN_') || k.startsWith('FN_'),
          ),
        ) as Record<string, string>,
      };

      let handler: (req: unknown, ctx: unknown) => unknown;
      try {
        handler = compileFunction(row.source);
      } catch (err) {
        if (err instanceof FunctionCompileError) throw ApiError.badRequest(err.message);
        throw err;
      }

      const outcome = await runFunction(
        handler,
        fnRequest,
        sandboxGlobals,
        FUNCTION_TIMEOUT_MS,
      );

      for (const [k, v] of Object.entries(outcome.headers)) res.setHeader(k, v);
      res.setHeader('x-vortex-function', row.name);
      res.status(outcome.status);
      if (outcome.body.length === 0) {
        res.end();
      } else {
        res.send(outcome.body);
      }
    } catch (err) {
      if (err instanceof FunctionTimeoutError) {
        next(new ApiError(508, 'function_timeout', err.message));
        return;
      }
      next(err);
    }
  });

  return router;
}

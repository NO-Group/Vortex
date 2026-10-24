import express, { raw, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AppContext } from './context.js';
import { createApiRouter } from './routes/index.js';
import { createPublicAppRoutes } from './apps/public.routes.js';
import { createPublicStorageRoutes } from './storage/public.routes.js';
import { createPublicFunctionRoutes } from './functions/functions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

/** Build the express application (factored out for testability). */
export function createApp(ctx: AppContext): Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind Caddy/nginx/preview proxies: trust X-Forwarded-* (presign auto,
  // real client IPs).
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin: ctx.env.corsOrigins === '*' ? true : ctx.env.corsOrigins,
    }),
  );

  // Rate limiting — protects auth, DB, and storage endpoints.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded', message: 'Too many requests. Try again later.' },
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
  });
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // 200 uploads per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Raw body capture for storage/app uploads MUST run before the JSON parser
  // so binary/JSON file payloads land intact instead of being re-serialized.
  app.use('/v1/storage/upload', uploadLimiter, raw({ type: () => true, limit: '64mb' }));
  app.use('/v1/storage/local/upload', uploadLimiter, raw({ type: () => true, limit: '64mb' }));
  app.use('/v1/apps/:name/files', uploadLimiter, raw({ type: () => true, limit: '64mb' }));

  app.use(express.json({ limit: '10mb' }));

  // Liveness probe (unauthenticated, load-balancer friendly).
  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'vortex',
      version: '0.1.0',
      realtime: {
        connections: ctx.hub.connectionCount,
      },
    });
  });

  // Rate-limited API surface — auth gets a stricter limit.
  app.use('/v1', apiLimiter, createApiRouter(ctx));

  // Public static hosting for deployed apps: GET /apps/<name>/*
  app.use('/apps', createPublicAppRoutes(ctx));

  // Public function invocation: ALL /functions/<name>
  app.use('/functions', createPublicFunctionRoutes(ctx));

  // Anonymous reads for public buckets: /v1/storage/public/<bucket>/*
  // (mounted via the api router would require auth middleware context — kept
  // here as its own family for a clean public surface.)
  app.use('/v1/storage/public', createPublicStorageRoutes(ctx));

  // ── The console: single-process deploys serve the built dashboard ──────
  // (dev keeps using Vite; SERVE_CONSOLE=false disables this entirely.)
  if (ctx.env.serveConsole) {
    const consoleDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../vortex-dashboard/dist',
    );
    const indexHtml = path.join(consoleDir, 'index.html');
    if (existsSync(indexHtml)) {
      app.use(express.static(consoleDir, { index: false, maxAge: '1h' }));
      const RESERVED = /^\/(v1|apps|functions|healthz)(\/|$)/;
      app.get('*', (req, res, next) => {
        if (RESERVED.test(req.path)) return next();
        res.sendFile(indexHtml);
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

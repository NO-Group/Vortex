/**
 * Vortex Server — Express app factory.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import type { AppContext } from './context.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { RealtimeHub } from './realtime/hub.js';

export function createApp(ctx: AppContext): { app: Express; wss: WebSocketServer; hub: RealtimeHub } {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({ origin: ctx.env.corsOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));

  /** Health check endpoint. */
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'vortex-server',
      version: '0.1.0',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  /** Mount all API routes under /v1. */
  app.use('/v1', createApiRouter(ctx));

  // 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  app.use(errorHandler);

  const hub = new RealtimeHub();
  const wss = new WebSocketServer({ server: undefined, path: ctx.env.realtime.path });

  return { app, wss, hub };
}

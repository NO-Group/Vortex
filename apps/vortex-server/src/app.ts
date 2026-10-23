import express, { raw, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { AppContext } from './context.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

/** Build the express application (factored out for testability). */
export function createApp(ctx: AppContext): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: ctx.env.corsOrigins === '*' ? true : ctx.env.corsOrigins,
    }),
  );

  // Raw body capture for storage uploads MUST run before the JSON parser so
  // binary/JSON file payloads land intact instead of being re-serialized.
  app.use('/v1/storage/upload', raw({ type: () => true, limit: '64mb' }));
  app.use('/v1/storage/local/upload', raw({ type: () => true, limit: '64mb' }));

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

  app.use('/v1', createApiRouter(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

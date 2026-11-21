import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppContext } from '../context.js';
import { AppsService } from './apps.service.js';

/**
 * Public app hosting — `GET /apps/:name/*`.
 *
 * Serves deployed static files with SPA fallback to `index.html`.
 * Unauthenticated by design: apps are meant to be visited in a browser.
 */
export function createPublicAppRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new AppsService(ctx.db, ctx.storage);

  const serve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = String(req.params.name ?? '');
      // Express 4 splat: GET /:name/*  →  req.params[0] holds the rest
      // (usually with a leading slash, e.g. "/css/app.css").
      const splat = req.params[0] ?? req.params.path ?? '';
      const pathParam = String(splat).replace(/^\/+/, '');

      const file = await service.readPublic(name, pathParam);
      if (!file) {
        const safeName = name.replace(/[<>&"']/g, '');
        res
          .status(404)
          .type('html')
          .send(
            `<!doctype html><html><body style="background:#000;color:#8B949E;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
             <div style="text-align:center"><div style="font-size:48px">🌪️</div>
             <p>App <b style="color:#fff">${safeName}</b> not found or still deploying.</p></div></body></html>`,
          );
        return;
      }

      res.setHeader('content-type', file.contentType);
      res.setHeader(
        'cache-control',
        file.path.endsWith('.html') ? 'no-cache' : 'public, max-age=300',
      );
      res.setHeader('x-vortex-app', name);
      res.send(file.body);
    } catch (err) {
      next(err);
    }
  };

  /** GET /apps/:name and /apps/:name/ — app root. */
  router.get('/:name', serve);
  router.get('/:name/', serve);

  /** GET /apps/:name/* — any file; extension-less paths fall back to the SPA index. */
  router.get('/:name/*', serve);

  return router;
}

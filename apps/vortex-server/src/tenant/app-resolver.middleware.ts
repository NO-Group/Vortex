import type { NextFunction, Request, Response } from 'express';
import type { TenantService } from './tenant.service.js';
import type { AppResolutionSource } from './tenant.types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Resolved app tenant for this request (null if single-tenant). */
      tenant?: { id: string; name: string; title: string; ownerId: string | null };
      /** How the app was resolved (header / subdomain / custom_domain / none). */
      tenantSource?: AppResolutionSource;
    }
  }
}

/**
 * App resolver middleware — extracts the app tenant from the request and
 * attaches it to `req.tenant` for downstream handlers.
 *
 * Resolution priority:
 *   1. `X-App-ID` header (explicit binding from API clients)
 *   2. Custom domain (reverse-proxy detected)
 *   3. Subdomain of the public app URL
 *
 * Resolution is async and non-blocking: if the app can't be resolved,
 * `req.tenant` stays null and the request continues in single-tenant mode.
 */
export function createAppResolverMiddleware(tenantService: TenantService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. X-App-ID header
      const headerApp = req.header('x-app-id');
      if (headerApp) {
        const app = await tenantService.resolveByName(headerApp);
        if (app) {
          req.tenant = { id: app.id, name: app.name, title: app.title, ownerId: app.ownerId };
          req.tenantSource = 'header';
          return next();
        }
      }

      // 2. Custom domain (from Host header)
      const host = req.header('host') ?? '';
      const hostNoPort = host.split(':')[0]?.toLowerCase();
      if (hostNoPort && hostNoPort !== 'localhost' && !hostNoPort.endsWith('vortex.local')) {
        const app = await tenantService.resolveByDomain(hostNoPort);
        if (app) {
          req.tenant = { id: app.id, name: app.name, title: app.title, ownerId: app.ownerId };
          req.tenantSource = 'custom_domain';
          return next();
        }
      }

      // 3. Subdomain (e.g. booknest.vortex.local → app "booknest")
      if (hostNoPort && hostNoPort.includes('.')) {
        const subdomain = hostNoPort.split('.')[0];
        if (subdomain && subdomain.length > 0 && subdomain !== 'www') {
          const app = await tenantService.resolveByName(subdomain);
          if (app) {
            req.tenant = { id: app.id, name: app.name, title: app.title, ownerId: app.ownerId };
            req.tenantSource = 'subdomain';
            return next();
          }
        }
      }

      // No app resolved — single-tenant mode
      req.tenantSource = 'none';
    } catch {
      // Resolution errors are non-fatal; continue in single-tenant mode
      req.tenantSource = 'none';
    }
    next();
  };
}

/**
 * Create a tenant-bound actor for the QueryService.
 *
 * When `req.tenant` is present, the actor includes `appId` so the query
 * compiler can auto-scope queries to the tenant's data.
 */
export function tenantActor(req: Request) {
  const auth = req.auth;
  if (!auth) return null;

  return {
    userId: auth.sub,
    role: auth.role,
    email: auth.email ?? null,
    meta: auth.meta ?? {},
    appId: req.tenant?.id ?? null,
  };
}

/**
 * Get the app ID from the request for direct use in queries.
 */
export function getAppId(req: Request): string | null {
  return req.tenant?.id ?? null;
}

/**
 * Get the app name from the request.
 */
export function getAppName(req: Request): string | null {
  return req.tenant?.name ?? null;
}

import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import type { AppTenant } from './tenant.types.js';

interface AppRow {
  id: string;
  name: string;
  title: string;
  owner_id: string | null;
  created_at: Date | string;
}

interface DomainRow {
  app_id: string;
  domain: string;
  status: string;
}

/**
 * Tenant service — resolves which Vortex app a request belongs to.
 *
 * Resolution order:
 *   1. `X-App-ID` header (explicit API client binding)
 *   2. Custom domain (e.g. `booknest.vortex.local`)
 *   3. Subdomain (e.g. `booknest.vortex.local` → app "booknest")
 *
 * If no app is resolved, `app` is null and queries fall back to
 * owner-id scoping (backward compatible with single-tenant deployments).
 */
export class TenantService {
  private domainCache = new Map<string, string>();
  private appCache = new Map<string, AppTenant>();

  constructor(private readonly db: Knex) {}

  /** Resolve an app by its name (from subdomain or X-App-ID header). */
  async resolveByName(name: string): Promise<AppTenant | null> {
    if (!name || name.length > 64) return null;
    if (this.appCache.has(name)) return this.appCache.get(name)!;

    const [row] = await this.db<AppRow>('apps')
      .where({ name })
      .limit(1);

    if (!row) return null;

    const domains = await this.getDomains(row.id);
    const tenant: AppTenant = {
      id: row.id,
      name: row.name,
      title: row.title,
      ownerId: row.owner_id,
      domains,
      createdAt: new Date(row.created_at).toISOString(),
    };
    this.appCache.set(name, tenant);
    return tenant;
  }

  /** Resolve an app by custom domain. */
  async resolveByDomain(domain: string): Promise<AppTenant | null> {
    const key = domain.toLowerCase();
    if (this.domainCache.has(key)) {
      const appId = this.domainCache.get(key)!;
      return this.resolveById(appId);
    }

    const [row] = await this.db<DomainRow>('vortex_custom_domains')
      .where({ domain: key, status: 'active' })
      .limit(1);

    if (!row) return null;

    this.domainCache.set(key, row.app_id);
    return this.resolveById(row.app_id);
  }

  /** Resolve an app by its UUID. */
  async resolveById(appId: string): Promise<AppTenant | null> {
    const [row] = await this.db<AppRow>('apps')
      .where({ id: appId })
      .limit(1);

    if (!row) return null;

    const domains = await this.getDomains(row.id);
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      ownerId: row.owner_id,
      domains,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  /** Get all verified custom domains for an app. */
  private async getDomains(appId: string): Promise<string[]> {
    const rows = await this.db<DomainRow>('vortex_custom_domains')
      .where({ app_id: appId, status: 'active' })
      .select('domain');
    return rows.map((r) => r.domain);
  }

  /** Clear caches (for tests or after app updates). */
  clearCache(): void {
    this.domainCache.clear();
    this.appCache.clear();
  }
}

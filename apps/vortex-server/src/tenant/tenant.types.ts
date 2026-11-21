/**
 * Multi-Tenant App Scoping — Type Definitions
 *
 * Vortex acts as the universal backbone for N.O Group products. Each product
 * (N.O Workspace, N.O Connect, BookNest, Tungsten) is a separate "app" hosted
 * on the same Vortex server. The tenant layer ensures that data from one app
 * cannot leak into another through the database gateway.
 */

/** An app (tenant) in the Vortex registry. */
export interface AppTenant {
  id: string;
  name: string;
  title: string;
  ownerId: string | null;
  /** Custom domains mapped to this app. */
  domains: string[];
  createdAt: string;
}

/** How an app was resolved for this request. */
export type AppResolutionSource = 'header' | 'subdomain' | 'custom_domain' | 'none';

/** The app context attached to every request. */
export interface AppBoundContext {
  /** The resolved app, or null if no app was identified. */
  app: AppTenant | null;
  /** How the app was resolved (for debugging / audit). */
  appSource: AppResolutionSource;
}

/** Result of resolving an app for a request. */
export interface AppResolution {
  app: AppTenant | null;
  source: AppResolutionSource;
}

/** Tables that support app-level scoping. */
export const APP_SCOPED_TABLES = new Set([
  'apps',
  'app_files',
  'chunked_uploads',
  'storage_objects',
  'api_keys',
  'webhooks',
  'functions',
]);

/** Vortex Apps — deploy and host static web apps from the engine. */

export interface AppMeta {
  id: string;
  name: string;
  title: string;
  ownerId: string | null;
  createdAt: string;
}

export interface AppFileMeta {
  id: string;
  appId: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string;
}

/** App names that would collide with engine routes. */
export const RESERVED_APP_NAMES = new Set([
  'v1',
  'apps',
  'api',
  'healthz',
  'assets',
  'static',
  'login',
  'auth',
  'storage',
  'realtime',
  'dashboard',
]);

const APP_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

/** Validate an app name (URL slug). Returns the name or throws BadRequest. */
export function validateAppName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!APP_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      'App name must be 1-30 chars of lowercase letters, digits, and dashes (no leading/trailing dash)',
    );
  }
  if (RESERVED_APP_NAMES.has(trimmed)) {
    throw new Error(`"${trimmed}" is a reserved name`);
  }
  return trimmed;
}

/**
 * Resolve a request path inside an app to a safe storage-relative file path.
 * - strips leading slashes
 * - rejects traversal (`..`, absolute, null bytes)
 * - empty path → `index.html`
 * - no extension → caller should consider SPA fallback (returns path as-is)
 */
export function resolveAppPath(rawPath: string): string {
  const normalized = rawPath
    .split('?')[0]!
    .split('#')[0]!
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');

  if (
    normalized.includes('\0') ||
    normalized.split('/').some((seg) => seg === '..')
  ) {
    throw new Error(`Invalid app path: "${rawPath}"`);
  }
  return normalized === '' ? 'index.html' : normalized;
}

const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  pdf: 'application/pdf',
  xml: 'application/xml',
  webmanifest: 'application/manifest+json',
};

/** Guess a content type from a file path. */
export function contentTypeFor(path: string): string {
  const ext = path.includes('.') ? path.split('.').pop()!.toLowerCase() : '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

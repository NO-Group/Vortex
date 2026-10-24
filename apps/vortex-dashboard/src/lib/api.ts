/**
 * Vortex Console API client.
 * All calls are same-origin (the dev server proxies /v1 → vortex-server),
 * so the browser never touches localhost directly.
 *
 * Session model: an in-memory token is the source of truth while the tab is
 * alive; localStorage is a best-effort persistence layer (the console may run
 * inside sandboxed iframes where storage is partitioned or unavailable).
 */

const TOKEN_KEY = 'vortex.token';
const USER_KEY = 'vortex.user';

/** In-memory session token — survives storage being flaky or blocked. */
let memoryToken: string | null = null;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — session stays in memory */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  return memoryToken ?? safeGet(TOKEN_KEY);
}

export function setToken(token: string): void {
  memoryToken = token;
  safeSet(TOKEN_KEY, token);
}

export function clearToken(): void {
  memoryToken = null;
  safeRemove(TOKEN_KEY);
  safeRemove(USER_KEY);
}

/** True when a JWT's `exp` is meaningfully in the past (2-min clock tolerance). */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() - 120_000;
  } catch {
    return true; // undecodable = unusable
  }
}

/** Timestamp of the most recent successful sign-in (grace window). */
let lastSignInAt = 0;
export function markSignIn(): void {
  lastSignInAt = Date.now();
}

export interface StoredUser {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  safeSet(USER_KEY, JSON.stringify(user));
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * A 401 may only end the session when ALL of these hold:
 *  1. the failing call is not a login/signup attempt (those 401s mean
 *     "wrong credentials", not "you were signed in"),
 *  2. the failing call actually carried a token,
 *  3. that token is still the CURRENT token (a stale in-flight request
 *     from a previous session must never clear a fresh login),
 *  4. we are outside the post-sign-in grace window (transient proxy
 *     hiccups right after login surface as errors, not a sign-out).
 */
function shouldEndSession(path: string, sentToken: string | null): boolean {
  if (path.startsWith('/v1/auth/login') || path.startsWith('/v1/auth/signup')) {
    return false;
  }
  if (!sentToken) return false;
  if (sentToken !== getToken()) return false;
  if (Date.now() - lastSignInAt < 5_000) return false;
  return true;
}

function endSession(path: string, message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[vortex] session ended: ${message} (${path})`);
  clearToken();
  window.dispatchEvent(
    new CustomEvent('vortex:logout', {
      detail: { reason: 'expired', path, message },
    }),
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  const sentToken = getToken();
  if (sentToken) {
    headers.set('authorization', `Bearer ${sentToken}`);
    // Fallback channel: some preview/proxy edges strip `Authorization`.
    headers.set('x-vortex-token', sentToken);
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } }).error;
    const message = err?.message ?? `Request failed with status ${res.status}`;
    if (res.status === 401 && shouldEndSession(path, sentToken)) {
      endSession(path, message);
    }
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown_error',
      err?.message ?? `Request failed with status ${res.status}`,
      err?.details,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
  /** Raw upload with auth (used by the storage browser). */
  upload: (key: string, file: File) => {
    const token = getToken();
    return fetch(`/v1/storage/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        ...(token ? { authorization: `Bearer ${token}`, 'x-vortex-token': token } : {}),
      },
      body: file,
    });
  },
};

// ── Engine API shapes ────────────────────────────────────────────────────

export interface Health {
  status: string;
  engine: string;
  version: string;
  realtime: { connections: number };
}

export interface AuthSession {
  user: StoredUser;
  token: string;
  expiresIn: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  count: number;
}

export interface PresignedUrl {
  key: string;
  method: 'PUT' | 'GET';
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StorageObject {
  id: string;
  key: string;
  size: number;
  contentType: string;
  ownerId: string | null;
  createdAt: string;
}

export interface TableEvent {
  type: 'vortex:event';
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  rows: Record<string, unknown>[];
  actorId: string | null;
  timestamp: string;
}

export interface NotificationDevice {
  id: string;
  platform: string;
  pushService: string;
  active: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface NotificationStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

export interface StorageStats {
  totalObjects: number;
  totalSize: number;
  byBucket: Record<string, { count: number; size: number }>;
}

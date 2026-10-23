/**
 * Vortex Console API client.
 * All calls are same-origin (the dev server proxies /v1 → vortex-server),
 * so the browser never touches localhost directly.
 */

const TOKEN_KEY = 'vortex.token';
const USER_KEY = 'vortex.user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body && typeof init.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } }).error;
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new Event('vortex:logout'));
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
        ...(token ? { authorization: `Bearer ${token}` } : {}),
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

/**
 * Vortex Dashboard — API client for communicating with the Vortex server.
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000/v1';

function getToken(): string | null {
  return localStorage.getItem('vortex_token');
}

function setToken(token: string): void {
  localStorage.setItem('vortex_token', token);
}

function clearToken(): void {
  localStorage.removeItem('vortex_token');
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'unknown', message: 'Request failed' }));
    const error = new Error(errorBody.message ?? `HTTP ${response.status}`);
    (error as any).code = errorBody.error;
    (error as any).status = response.status;
    if (response.status === 401) {
      clearToken();
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async signup(email: string, password: string, name: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const result = await request<{ user: AuthUser; tokens: AuthTokens }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setToken(result.tokens.accessToken);
    return result;
  },

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const result = await request<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.tokens.accessToken);
    return result;
  },

  async me(): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/auth/me');
  },

  logout(): void {
    clearToken();
  },

  // ── Database ───────────────────────────────────────────────────────────────
  async selectTable(table: string, limit = 100): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    const params = new URLSearchParams({ table, limit: String(limit) });
    return request(`/db/select?${params}`);
  },

  async insertRow(table: string, row: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    return request('/db/insert', {
      method: 'POST',
      body: JSON.stringify({ table, rows: [row] }),
    });
  },

  async updateRows(table: string, filters: Record<string, unknown>, patch: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    return request('/db/update', {
      method: 'POST',
      body: JSON.stringify({
        table,
        filters: Object.entries(filters).map(([column, value]) => ({ column, op: 'eq', value })),
        patch,
      }),
    });
  },

  async deleteRows(table: string, filters: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    return request('/db/delete', {
      method: 'POST',
      body: JSON.stringify({
        table,
        filters: Object.entries(filters).map(([column, value]) => ({ column, op: 'eq', value })),
      }),
    });
  },

  // ── Storage ───────────────────────────────────────────────────────────────
  async listObjects(): Promise<{ objects: StorageObject[] }> {
    return request('/storage/list');
  },

  async presignUpload(key: string, contentType?: string): Promise<PresignedUrl> {
    return request('/storage/presign-upload', {
      method: 'POST',
      body: JSON.stringify({ key, contentType }),
    });
  },

  async deleteObject(key: string): Promise<void> {
    await request('/storage/object', {
      method: 'DELETE',
      body: JSON.stringify({ key }),
    });
  },

  // ── Health ─────────────────────────────────────────────────────────────────
  async health(): Promise<{ status: string; service: string; version: string }> {
    const response = await fetch(`${API_BASE.replace('/v1', '')}/health`);
    return response.json();
  },
};

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  ownerId: string | null;
  createdAt: string;
}

export interface PresignedUrl {
  url: string;
  expiresAt: string;
  expiresIn: number;
  method: string;
}

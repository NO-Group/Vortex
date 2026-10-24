import type { ApiErrorBody } from './types.js';

/**
 * Vortex HTTP transport — fetch-based, zero-dependency.
 *
 * Handles: base URL resolution, auth headers, JSON encoding, error
 * normalization, and auto-retry on transient failures. Works in both
 * browser and Node.js 18+.
 */

export interface HttpClientOptions {
  /** Absolute base URL (also passed as the first constructor arg). */
  baseUrl?: string;
  /** JWT access token, attached to every request as a Bearer header. */
  token?: string | null;
  /** Default request timeout (ms). */
  timeout?: number;
  /** Number of retries on 5xx / network errors. */
  retries?: number;
}

export class VortexApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'VortexApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class HttpClient {
  private token: string | null = null;
  /** Base URL (without trailing slash). */
  get baseUrl(): string {
    return this._baseUrl;
  }
  private readonly timeout: number;
  private readonly retries: number;

  private readonly _baseUrl: string;

  constructor(baseUrl: string, opts: HttpClientOptions = {}) {
    this._baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = opts.timeout ?? 30_000;
    this.retries = opts.retries ?? 1;
    if (opts.token) this.token = opts.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /** Make an HTTP request with automatic retry on transient errors. */
  async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      headers?: Record<string, string>;
      raw?: boolean;
      timeout?: number;
    } = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, raw = false, timeout } = options;

    const doFetch = async (): Promise<Response> => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout ?? this.timeout);

      try {
        return await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
            ...headers,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(t);
      }
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await doFetch();

        if (res.status === 401) {
          // Token expired or invalid — don't retry, let the caller handle it.
          const body = await this.parseBody(res);
          throw this.toApiError(res.status, body);
        }

        if (res.status >= 500 && attempt < this.retries) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }

        if (res.status >= 400) {
          const body = await this.parseBody(res);
          throw this.toApiError(res.status, body);
        }

        if (raw) return (await res.arrayBuffer()) as unknown as T;
        if (res.status === 204) return undefined as unknown as T;
        return (await res.json()) as T;
      } catch (err) {
        lastError = err;
        if (err instanceof VortexApiError && err.status === 401) throw err;
        if (attempt < this.retries && !(err instanceof VortexApiError)) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Request failed');
  }

  private async parseBody(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return { error: { code: 'unknown', message: res.statusText } };
    }
  }

  private toApiError(status: number, body: unknown): VortexApiError {
    if (body && typeof body === 'object' && 'error' in body) {
      const err = (body as ApiErrorBody).error;
      return new VortexApiError(status, err.code, err.message, err.details);
    }
    return new VortexApiError(status, 'unknown', `HTTP ${status}`);
  }

  /** Upload a file as raw bytes (not JSON). */
  async uploadRaw(path: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<Response> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': contentType,
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: (data instanceof Uint8Array
          ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          : data) as BodyInit,
        signal: controller.signal,
      });

      if (res.status >= 400) {
        const body = await this.parseBody(res);
        throw this.toApiError(res.status, body);
      }
      return res;
    } finally {
      clearTimeout(t);
    }
  }
}

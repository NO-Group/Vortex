/**
 * Vortex HTTP client with retry logic.
 */
export class VortexApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VortexApiError';
  }
}

interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeout?: number;
  retries?: number;
}

export class HttpClient {
  private baseUrl: string;
  private token: string | null = null;
  private timeout: number;
  private retries: number;

  constructor(baseUrl: string, opts: Partial<HttpOptions> = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = opts.timeout ?? 30000;
    this.retries = opts.retries ?? 2;
    if (opts.token) this.token = opts.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(path: string, opts: HttpOptions = {}): Promise<T> {
    const { method = 'GET', body, timeout } = opts;

    const doFetch = async (): Promise<Response> => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout ?? this.timeout);
      try {
        return await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
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
          const parsed = await res.json().catch(() => null);
          throw new VortexApiError(401, 'unauthorized', 'Unauthorized');
        }
        if (res.status >= 500 && attempt < this.retries) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
        if (!res.ok) {
          const parsed = await res.json().catch(() => null);
          const code = parsed?.error?.code ?? 'error';
          const msg = parsed?.error?.message ?? res.statusText;
          throw new VortexApiError(res.status, code, msg);
        }
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof VortexApiError && err.status !== 500) throw err;
        lastError = err;
        if (attempt === this.retries) break;
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
      }
    }
    throw lastError;
  }
}

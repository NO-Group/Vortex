import type { HttpClient } from './http.js';
import type { VortexFunction } from './types.js';

/**
 * Vortex Functions — deploy and invoke server-side functions.
 *
 * Functions run in the engine's sandboxed VM with a wall-clock budget.
 * They can query the database, read context, and return JSON.
 *
 * ```ts
 * await vortex.functions.deploy('hello', async (ctx) => {
 *   return { message: 'Hello from Vortex' };
 * });
 * const result = await vortex.functions.invoke('hello', { name: 'world' });
 * ```
 */
export class Functions {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  /** List all deployed functions. */
  async list(): Promise<VortexFunction[]> {
    const { functions } = await this.http.request<{ functions: VortexFunction[] }>('/v1/functions');
    return functions;
  }

  /** Deploy a new function. */
  async deploy(
    name: string,
    source: string,
    title?: string,
  ): Promise<VortexFunction> {
    const { function: fn } = await this.http.request<{ function: VortexFunction }>(
      '/v1/functions',
      { method: 'POST', body: { name, source, title } },
    );
    return fn;
  }

  /** Get a function's metadata. */
  async get(name: string): Promise<VortexFunction> {
    const { function: fn } = await this.http.request<{ function: VortexFunction }>(
      `/v1/functions/${name}`,
    );
    return fn;
  }

  /** Update a function's source, title, or status. */
  async update(
    name: string,
    patch: { source?: string; title?: string; status?: 'active' | 'paused' },
  ): Promise<VortexFunction> {
    const { function: fn } = await this.http.request<{ function: VortexFunction }>(
      `/v1/functions/${name}`,
      { method: 'PATCH', body: patch },
    );
    return fn;
  }

  /** Delete a function. */
  async remove(name: string): Promise<void> {
    await this.http.request(`/v1/functions/${name}`, { method: 'DELETE' });
  }

  /**
   * Invoke a function over HTTP. Anonymous invocation (no auth header)
   * is allowed for deployed functions — the function receives the
   * caller context.
   */
  async invoke<T = unknown>(name: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/functions/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status >= 400) {
      const err = await res.json().catch(() => ({}));
      const message = err.error?.message ?? `HTTP ${res.status}`;
      throw new Error(message);
    }

    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }
}

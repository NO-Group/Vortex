import { HttpClient } from './http.js';

export class Functions {
  constructor(private readonly http: HttpClient, private readonly baseUrl: string) {}

  async deploy(name: string, code: string, description = ''): Promise<{ name: string; status: string }> {
    return this.http.request('/v1/functions', { method: 'POST', body: { name, code, description } });
  }

  async list(): Promise<{ functions: unknown[] }> {
    return this.http.request('/v1/functions');
  }

  async get(name: string): Promise<unknown> {
    return this.http.request(`/v1/functions/${name}`);
  }

  async update(name: string, updates: Record<string, unknown>): Promise<unknown> {
    return this.http.request(`/v1/functions/${name}`, { method: 'PATCH', body: updates });
  }

  async delete(name: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/functions/${name}`, { method: 'DELETE' });
  }

  async invoke(name: string, data: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/functions/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Function invocation failed: ${res.status}`);
    return res.json();
  }
}

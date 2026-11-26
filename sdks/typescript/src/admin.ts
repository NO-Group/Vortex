import { HttpClient } from './http.js';

export class Admin {
  constructor(private readonly http: HttpClient) {}

  async sql(statement: string): Promise<{ rows: unknown[]; count: number }> {
    return this.http.request('/v1/sql', { method: 'POST', body: { sql: statement } });
  }

  async listPolicies(): Promise<{ policies: unknown[] }> {
    return this.http.request('/v1/policies');
  }

  async createPolicy(input: Record<string, unknown>): Promise<unknown> {
    return this.http.request('/v1/policies', { method: 'POST', body: input });
  }

  async previewPolicy(input: Record<string, unknown>): Promise<unknown> {
    return this.http.request('/v1/policies/preview', { method: 'POST', body: input });
  }

  async updatePolicy(id: string, updates: Record<string, unknown>): Promise<unknown> {
    return this.http.request(`/v1/policies/${id}`, { method: 'PATCH', body: updates });
  }

  async deletePolicy(id: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/policies/${id}`, { method: 'DELETE' });
  }

  async listUsers(): Promise<{ users: unknown[] }> {
    return this.http.request('/v1/auth/users');
  }

  async updateUser(userId: string, updates: Record<string, unknown>): Promise<unknown> {
    return this.http.request(`/v1/auth/users/${userId}`, { method: 'PATCH', body: updates });
  }

  async deleteUser(userId: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/auth/users/${userId}`, { method: 'DELETE' });
  }

  async queryLog(limit = 50): Promise<{ queries: unknown[] }> {
    return this.http.request(`/v1/insights/queries?limit=${limit}`);
  }

  async insightsOverview(): Promise<{ total: number; avgDurationMs: number; maxCost: number; rejected: number; ceiling: number }> {
    return this.http.request('/v1/insights/overview');
  }
}

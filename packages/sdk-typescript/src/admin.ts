import type { HttpClient } from './http.js';
import type {
  SqlResult, VortexPolicy, PolicyPreview, QueryLogEntry, InsightsOverview, PolicyNode,
} from './types.js';

/**
 * Vortex Admin — SQL console, policy management, and query insights.
 * All operations require the admin role.
 */
export class Admin {
  constructor(private readonly http: HttpClient) {}

  // ── SQL Console ──────────────────────────────────────────────────────

  /** Execute a single SQL statement (admin only). */
  async sql(statement: string): Promise<SqlResult> {
    return this.http.request<SqlResult>('/v1/sql', {
      method: 'POST',
      body: { sql: statement },
    });
  }

  // ── Policy Engine ─────────────────────────────────────────────────────

  /** List policies, optionally filtered by table. */
  async listPolicies(table?: string): Promise<VortexPolicy[]> {
    const query = table ? `?table=${encodeURIComponent(table)}` : '';
    const { policies } = await this.http.request<{ policies: VortexPolicy[] }>(
      `/v1/policies${query}`,
    );
    return policies;
  }

  /** Create a row policy. */
  async createPolicy(input: {
    name: string;
    tableName: string;
    action: 'select' | 'insert' | 'update' | 'delete';
    roles: string[];
    using: PolicyNode;
    withCheck?: PolicyNode | null;
    enabled?: boolean;
  }): Promise<VortexPolicy> {
    const { policy } = await this.http.request<{ policy: VortexPolicy }>('/v1/policies', {
      method: 'POST',
      body: input,
    });
    return policy;
  }

  /** Update a policy. */
  async updatePolicy(
    id: string,
    patch: Partial<{
      name: string;
      action: 'select' | 'insert' | 'update' | 'delete';
      roles: string[];
      using: PolicyNode;
      withCheck: PolicyNode | null;
      enabled: boolean;
    }>,
  ): Promise<VortexPolicy> {
    const { policy } = await this.http.request<{ policy: VortexPolicy }>(
      `/v1/policies/${id}`,
      { method: 'PATCH', body: patch },
    );
    return policy;
  }

  /** Delete a policy. */
  async deletePolicy(id: string): Promise<void> {
    await this.http.request(`/v1/policies/${id}`, { method: 'DELETE' });
  }

  /**
   * Preview what SQL a policy set produces for a hypothetical caller.
   * Shows the bound predicate and the per-row equivalent it replaces.
   */
  async previewPolicy(input: {
    tableName: string;
    action: 'select' | 'insert' | 'update' | 'delete';
    role: string;
    userId?: string;
    meta?: Record<string, unknown>;
  }): Promise<PolicyPreview> {
    return this.http.request<PolicyPreview>('/v1/policies/preview', {
      method: 'POST',
      body: input,
    });
  }

  // ── Query Governance / Insights ───────────────────────────────────────

  /** List recent slow / refused queries. */
  async queryLog(limit?: number): Promise<QueryLogEntry[]> {
    const query = limit ? `?limit=${limit}` : '';
    const { queries } = await this.http.request<{ queries: QueryLogEntry[] }>(
      `/v1/insights/queries${query}`,
    );
    return queries;
  }

  /** Get aggregate query stats for the last hour. */
  async insightsOverview(): Promise<InsightsOverview> {
    return this.http.request<InsightsOverview>('/v1/insights/overview');
  }
}

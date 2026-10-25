import type { HttpClient } from './http.js';
import type { ApiKey, ApiKeyCreateResult } from './types.js';

/**
 * Vortex API Keys — server-to-server authentication.
 *
 * Create API keys for automated systems, CI/CD pipelines, or
 * backend services. Keys authenticate via the standard
 * `Authorization: Bearer vortex_live_…` header.
 *
 * ```ts
 * const { key } = await vortex.apiKeys.create({
 *   name: 'production-server',
 *   scopes: ['database:read', 'storage:write'],
 * });
 * // Use the key in your server's Authorization header:
 * // curl -H "Authorization: Bearer $KEY" …
 * ```
 */
export class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  /** Create a new API key. The full key is returned only at creation. */
  async create(input: {
    name: string;
    scopes?: string[];
  }): Promise<ApiKeyCreateResult> {
    const { apiKey } = await this.http.request<{ apiKey: ApiKeyCreateResult }>(
      '/v1/api-keys',
      {
        method: 'POST',
        body: input,
      },
    );
    return apiKey;
  }

  /** List active API keys. */
  async list(): Promise<ApiKey[]> {
    const { apiKeys } = await this.http.request<{ apiKeys: ApiKey[] }>(
      '/v1/api-keys',
    );
    return apiKeys;
  }

  /** Revoke (delete) an API key. Irreversible. */
  async revoke(apiKeyId: string): Promise<void> {
    await this.http.request(`/v1/api-keys/${apiKeyId}`, {
      method: 'DELETE',
    });
  }
}

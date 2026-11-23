import type { HttpClient } from './http.js';
import type { FeatureFlag, FlagEvaluation } from './types.js';

/**
 * Vortex Feature Flags — remote config and gradual rollouts.
 *
 * ```ts
 * // Create a flag
 * await vortex.flags.create({
 *   key: 'new-dashboard',
 *   status: 'gradual',
 *   rolloutPercentage: 25,
 * });
 *
 * // Check if a flag is enabled for the current user
 * const result = await vortex.flags.evaluate('new-dashboard');
 * if (result.enabled) {
 *   // show the new dashboard
 * }
 *
 * // Get all flags at once
 * const all = await vortex.flags.evaluateAll();
 * ```
 */
export class Flags {
  constructor(private readonly http: HttpClient) {}

  /** Create a new feature flag. */
  async create(input: {
    key: string;
    description?: string;
    status?: 'off' | 'on' | 'gradual';
    rolloutPercentage?: number;
    targeting?: Record<string, unknown>;
    variants?: Array<Record<string, unknown>>;
  }): Promise<FeatureFlag> {
    const { flag } = await this.http.request<{ flag: FeatureFlag }>(
      '/v1/flags',
      { method: 'POST', body: input },
    );
    return flag;
  }

  /** List all feature flags. */
  async list(): Promise<FeatureFlag[]> {
    const { flags } = await this.http.request<{ flags: FeatureFlag[] }>(
      '/v1/flags',
    );
    return flags;
  }

  /** Update a feature flag. */
  async update(flagId: string, input: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const { flag } = await this.http.request<{ flag: FeatureFlag }>(
      `/v1/flags/${flagId}`,
      { method: 'PATCH', body: input },
    );
    return flag;
  }

  /** Delete a feature flag. */
  async delete(flagId: string): Promise<void> {
    await this.http.request(`/v1/flags/${flagId}`, { method: 'DELETE' });
  }

  /** Evaluate a single flag for the current user. */
  async evaluate(key: string): Promise<FlagEvaluation> {
    return this.http.request<FlagEvaluation>(
      `/v1/flags/evaluate?key=${encodeURIComponent(key)}`,
    );
  }

  /** Evaluate all flags for the current user. */
  async evaluateAll(): Promise<Record<string, boolean>> {
    const { flags } = await this.http.request<{ flags: Record<string, boolean> }>(
      '/v1/flags/evaluate-all',
    );
    return flags;
  }
}

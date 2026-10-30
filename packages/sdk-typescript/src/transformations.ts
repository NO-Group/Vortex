import type { HttpClient } from './http.js';
import type { MediaTransformation, TransformOperation } from './types.js';

/**
 * Media transformation client — `/v1/storage/transformations`.
 */
export class Transformations {
  constructor(private readonly http: HttpClient) {}

  /** Request a media transformation. */
  async request(
    key: string,
    operation: TransformOperation,
    params: Record<string, unknown>,
  ): Promise<Partial<MediaTransformation>> {
    return this.http.request<Partial<MediaTransformation>>('/v1/storage/transformations', {
      method: 'POST',
      body: { key, operation, params },
    });
  }

  /** List transformations for the caller. */
  async list(): Promise<{ transformations: MediaTransformation[] }> {
    return this.http.request<{ transformations: MediaTransformation[] }>('/v1/storage/transformations');
  }

  /** Get a single transformation by id. */
  async get(id: string): Promise<MediaTransformation> {
    return this.http.request<MediaTransformation>(`/v1/storage/transformations/${id}`);
  }

  /** Delete a transformation record. */
  async delete(id: string): Promise<void> {
    await this.http.request(`/v1/storage/transformations/${id}`, { method: 'DELETE' });
  }
}

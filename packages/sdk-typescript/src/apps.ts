import type { HttpClient } from './http.js';
import type { VortexApp } from './types.js';

/**
 * Vortex Apps — deploy and host static web apps.
 *
 * Apps are served from `/apps/<name>/` by the engine. Upload files,
 * get a live URL, and manage the deployment.
 *
 * ```ts
 * const app = await vortex.apps.create('my-app', 'My App');
 * await vortex.apps.uploadFile('my-app', 'index.html', htmlContent);
 * // → Live at /apps/my-app/
 * ```
 */
export class Apps {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  /** List all apps. */
  async list(): Promise<VortexApp[]> {
    const { apps } = await this.http.request<{ apps: VortexApp[] }>('/v1/apps');
    return apps;
  }

  /** Create a new app. */
  async create(name: string, title?: string): Promise<VortexApp> {
    const { app } = await this.http.request<{ app: VortexApp }>('/v1/apps', {
      method: 'POST',
      body: { name, title },
    });
    return app;
  }

  /** Get an app's metadata and file list. */
  async get(name: string): Promise<{ app: VortexApp; files: Array<{ path: string; size: number }> }> {
    return this.http.request(`/v1/apps/${name}`);
  }

  /** Delete an app. */
  async remove(name: string): Promise<void> {
    await this.http.request(`/v1/apps/${name}`, { method: 'DELETE' });
  }

  /** Upload a file to an app. */
  async uploadFile(name: string, path: string, content: string): Promise<{ path: string; size: number }> {
    const res = await this.http.uploadRaw(
      `/v1/apps/${name}/files?path=${encodeURIComponent(path)}`,
      new TextEncoder().encode(content),
      'text/plain',
    );
    return (await res.json()) as { path: string; size: number };
  }

  /** List files in an app. */
  async listFiles(name: string): Promise<Array<{ path: string; size: number }>> {
    const { files } = await this.http.request<{ files: Array<{ path: string; size: number }> }>(
      `/v1/apps/${name}/files`,
    );
    return files;
  }

  /** Delete a file from an app. */
  async deleteFile(name: string, path: string): Promise<void> {
    await this.http.request(`/v1/apps/${name}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  }

  /** Get the live URL for an app. */
  appUrl(name: string): string {
    return `${this.baseUrl}/apps/${name}/`;
  }
}

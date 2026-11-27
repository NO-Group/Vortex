import { HttpClient } from './http.js';

export class Apps {
  constructor(private readonly http: HttpClient) {}

  async create(name: string, title: string): Promise<{ name: string; title: string }> {
    return this.http.request('/v1/apps', { method: 'POST', body: { name, title } });
  }

  async list(): Promise<{ apps: unknown[] }> {
    return this.http.request('/v1/apps');
  }

  async get(name: string): Promise<unknown> {
    return this.http.request(`/v1/apps/${name}`);
  }

  async uploadFile(app: string, path: string, content: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/apps/${app}/files`, { method: 'POST', body: { path, content } });
  }

  async listFiles(app: string): Promise<{ files: unknown[] }> {
    return this.http.request(`/v1/apps/${app}/files`);
  }

  async deleteFile(app: string, path: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/apps/${app}/files`, { method: 'DELETE', body: { path } });
  }

  async delete(app: string): Promise<{ ok: boolean }> {
    return this.http.request(`/v1/apps/${app}`, { method: 'DELETE' });
  }
}

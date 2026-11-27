import { HttpClient } from './http.js';

export class Storage {
  constructor(private readonly http: HttpClient, private readonly baseUrl: string) {}

  async createBucket(name: string, isPublic = false): Promise<{ name: string; isPublic: boolean }> {
    return this.http.request('/v1/storage/buckets', { method: 'POST', body: { name, isPublic } });
  }

  async listBuckets(): Promise<{ buckets: Array<{ name: string; isPublic: boolean }> }> {
    return this.http.request('/v1/storage/buckets');
  }

  async deleteBucket(name: string): Promise<{ ok: boolean }> {
    return this.http.request('/v1/storage/buckets/' + name, { method: 'DELETE' });
  }

  async presignUpload(path: string): Promise<{ url: string; method: string; headers: Record<string, string> }> {
    return this.http.request('/v1/storage/presign-upload', { method: 'POST', body: { path } });
  }

  async upload(bucket: string, data: ArrayBuffer | Blob, path: string, contentType?: string): Promise<{ url: string }> {
    const res = await fetch(`${this.baseUrl}/v1/storage/object`, {
      method: 'POST',
      headers: {
        'content-type': contentType ?? 'application/octet-stream',
        ...(this.http.getToken() ? { authorization: `Bearer ${this.http.getToken()}` } : {}),
      },
      body: data as BodyInit,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  }

  async listObjects(bucket: string, prefix = ''): Promise<{ objects: Array<{ path: string; size: number }> }> {
    return this.http.request(`/v1/storage/list?bucket=${bucket}&prefix=${prefix}`);
  }

  async deleteObject(bucket: string, path: string): Promise<{ ok: boolean }> {
    return this.http.request('/v1/storage/object', { method: 'DELETE', body: { bucket, path } });
  }

  imageUrl(bucket: string, path: string, opts: Record<string, string | number> = {}): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts)) params.set(k, String(v));
    return `${this.baseUrl}/v1/storage/public/${bucket}/${path}?${params}`;
  }
}

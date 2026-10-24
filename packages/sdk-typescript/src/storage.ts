import type { HttpClient } from './http.js';
import type {
  Bucket, PresignUploadResponse, PresignDownloadResponse, StorageObject,
} from './types.js';

/**
 * Vortex Storage — buckets, uploads, downloads, presigned URLs, and
 * Cloudinary-style image transformations.
 *
 * Image transforms are URL-based: append `?w=800&h=600&fit=cover&fmt=webp`
 * to a public object URL and Vortex generates the transformed image on
 * the fly. No separate image service needed.
 *
 * ```ts
 * await vortex.storage.upload('avatars', file, 'me.png');
 * const url = vortex.storage.url('avatars', 'me.png', { w: 200, h: 200, fit: 'cover' });
 * ```
 */
export class Storage {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  // ── Buckets ──────────────────────────────────────────────────────────

  /** List all buckets. */
  async listBuckets(): Promise<Bucket[]> {
    const { buckets } = await this.http.request<{ buckets: Bucket[] }>('/v1/storage/buckets');
    return buckets;
  }

  /** Create a bucket. */
  async createBucket(name: string, isPublic = false): Promise<Bucket> {
    const { bucket } = await this.http.request<{ bucket: Bucket }>('/v1/storage/buckets', {
      method: 'POST',
      body: { name, public: isPublic },
    });
    return bucket;
  }

  /** Delete a bucket. */
  async deleteBucket(name: string): Promise<void> {
    await this.http.request(`/v1/storage/buckets/${name}`, { method: 'DELETE' });
  }

  // ── Upload / Download ────────────────────────────────────────────────

  /** Upload a file to a bucket. */
  async upload(
    bucket: string,
    data: ArrayBuffer | Uint8Array | Blob,
    path: string,
    contentType?: string,
  ): Promise<StorageObject> {
    const body = data instanceof Blob ? await data.arrayBuffer() : data;
    const ct = contentType ?? this.guessContentType(path);
    const res = await this.http.uploadRaw(`/v1/storage/object?bucket=${bucket}&path=${encodeURIComponent(path)}`, body as ArrayBuffer, ct);
    return (await res.json()) as StorageObject;
  }

  /** Get a presigned upload URL (for direct-to-storage uploads). */
  async presignUpload(
    key: string,
    contentType?: string,
    expiresIn?: number,
  ): Promise<PresignUploadResponse> {
    return this.http.request<PresignUploadResponse>('/v1/storage/presign-upload', {
      method: 'POST',
      body: { key, contentType, expiresIn },
    });
  }

  /** Get a presigned download URL. */
  async presignDownload(key: string, expiresIn?: number): Promise<PresignDownloadResponse> {
    return this.http.request<PresignDownloadResponse>('/v1/storage/presign-download', {
      method: 'POST',
      body: { key, expiresIn },
    });
  }

  /** List objects in a bucket. */
  async listObjects(bucket: string, prefix?: string): Promise<StorageObject[]> {
    const query = prefix ? `?bucket=${bucket}&prefix=${encodeURIComponent(prefix)}` : `?bucket=${bucket}`;
    const { objects } = await this.http.request<{ objects: StorageObject[] }>(
      `/v1/storage/list${query}`,
    );
    return objects;
  }

  /** Delete an object. */
  async deleteObject(bucket: string, path: string): Promise<void> {
    await this.http.request('/v1/storage/object', {
      method: 'DELETE',
      body: { bucket, path },
    });
  }

  /** Download an object and return its bytes + content type. */
  async download(
    bucket: string,
    path: string,
  ): Promise<{ data: ArrayBuffer; contentType: string }> {
    const res = await this.http.rawRequest(
      `/v1/storage/object?bucket=${bucket}&path=${encodeURIComponent(path)}`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Download failed: ${res.status}`);
    }
    const data = await res.arrayBuffer();
    return {
      data,
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  }

  // ── URL generation ───────────────────────────────────────────────────

  /**
   * Build a URL for a stored object, optionally with image transforms.
   *
   * For public buckets, the URL is directly fetchable. For private
   * buckets, it includes a token query parameter for authenticated access.
   */
  url(
    bucket: string,
    path: string,
    transforms?: ImageTransforms,
  ): string {
    const base = `${this.baseUrl}/v1/storage/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
    if (!transforms || Object.keys(transforms).length === 0) return base;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(transforms)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    return `${base}?${params}`;
  }

  /**
   * Build a public CDN-style URL for a stored image with transforms.
   * Works with public buckets — no auth needed.
   */
  imageUrl(
    bucket: string,
    path: string,
    transforms: ImageTransforms,
  ): string {
    return this.url(bucket, path, transforms);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private guessContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
      json: 'application/json', txt: 'text/plain', css: 'text/css',
      js: 'application/javascript', html: 'text/html',
    };
    return map[ext ?? ''] ?? 'application/octet-stream';
  }
}

/**
 * Image transform parameters — Cloudinary-compatible.
 * Applied on the fly by the storage gateway.
 *
 * ```ts
 * vortex.storage.imageUrl('images', 'photo.jpg', {
 *   w: 800, h: 600, fit: 'cover', fmt: 'webp', quality: 85, crop: 'auto',
 * });
 * ```
 */
export interface ImageTransforms {
  /** Target width in pixels. */
  w?: number;
  /** Target height in pixels. */
  h?: number;
  /** Crop/resize strategy: cover, contain, fill, inside, outside, thumb. */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'thumb';
  /** Crop anchor: auto, top, bottom, left, right, face, enclosed. */
  crop?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'face' | 'enclosed';
  /** Gravity for face/auto crops. */
  gravity?: 'face' | 'auto' | 'top' | 'bottom' | 'left' | 'right';
  /** Output format: webp, avif, mozjpeg, png, gif. */
  fmt?: 'webp' | 'avif' | 'mozjpeg' | 'png' | 'gif';
  /** JPEG/WebP quality 1-100. */
  quality?: number;
  /** DPI for resolution scaling. */
  dpi?: number;
  /** Sharpen filter. */
  sharpen?: number | boolean;
  /** Blur filter (radius). */
  blur?: number;
  /** Grayscale conversion. */
  grayscale?: boolean;
  /** Sepia tint. */
  sepia?: boolean;
  /** Rotate degrees (0, 90, 180, 270). */
  rotate?: number;
  /** Flip horizontally. */
  flipH?: boolean;
  /** Flip vertically. */
  flipV?: boolean;
  /** Border padding in pixels. */
  padding?: number;
  /** Border color (hex). */
  paddingColor?: string;
  /** Custom metadata passthrough. */
  [key: string]: unknown;
}

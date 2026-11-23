/**
 * TUS Protocol types.
 *
 * TUS is an open protocol for resumable file uploads:
 *   https://tus.io/protocols/resumable-upload
 *
 * Key headers:
 *   Upload-Length      — total file size in bytes
 *   Upload-Offset       — current byte offset (start of next chunk)
 *   Tus-Resumable       — protocol version (e.g. "1.0.0")
 *   Tus-Version         — supported versions (server response)
 *   Tus-Extension       — supported extensions (server response)
 *   Upload-Metadata     — comma-separated key=value pairs
 *   Upload-Checksum     — checksum for chunk verification
 *   X-HTTP-Method-Override — for PATCH via POST
 */

export const TUS_VERSION = '1.0.0';

export const TUS_EXTENSIONS = [
  'creation',          // POST to create an upload
  'creation-with-upload', // POST with body to create + upload first chunk
  'checksum',          // Upload-Checksum header
  'expiration',        // Upload expires after a period
  'concatenation',     // Concatenation extension for chunked creation
] as const;

export const TUS_MAX_VERSION = '2.0.0';

export interface TusUpload {
  uploadId: string;
  key: string;
  size: number;
  offset: number;
  contentType: string | null;
  metadata: Record<string, string>;
  checksum: string | null;
  expiresAt: string | null;
  createdAt: string;
  ownerId: string;
}

export interface TusUploadCreation {
  uploadId: string;
  key: string;
  size: number;
  offset: number;
  contentType: string | null;
  metadata: Record<string, string>;
  expiresAt: string | null;
  location: string;
}

export interface TusPatchResult {
  offset: number;
  received: number;
}

/** Parse the Upload-Metadata header into a key-value map. */
export function parseUploadMetadata(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const pair of header.split(',')) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const value = pair.slice(colonIdx + 1).trim();
    if (key) {
      result[key] = value || '';
    }
  }
  return result;
}

/** Encode metadata back to the Upload-Metadata header format. */
export function encodeUploadMetadata(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

/** Parse the Upload-Checksum header. */
export function parseUploadChecksum(header: string | undefined): { algorithm: string; value: string } | null {
  if (!header) return null;
  const spaceIdx = header.indexOf(' ');
  if (spaceIdx === -1) return null;
  const algorithm = header.slice(0, spaceIdx);
  const value = header.slice(spaceIdx + 1);
  if (!algorithm || !value) return null;
  return { algorithm, value };
}

/**
 * Derive a storage key from TUS metadata.
 * Looks for a "filename" or "key" metadata field; falls back to a UUID.
 */
export function deriveKeyFromMetadata(metadata: Record<string, string>, bucket: string): string {
  const filename = metadata.filename || metadata.key || metadata.name;
  if (filename) {
    // Sanitize and ensure it's in the right bucket
    const sanitized = filename.replace(/^[/\\]+/, '').replace(/\.\./g, '_');
    return `${bucket}/${sanitized}`;
  }
  return `${bucket}/tus-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.bin`;
}

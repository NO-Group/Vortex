import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Vortex Image Transforms — Cloudinary-compatible, URL-based.
 *
 * Append transform parameters to any public object URL:
 *
 *   GET /v1/storage/public/images/photo.jpg?w=800&h=600&fit=cover&fmt=webp
 *
 * The gateway reads the original, applies the transform with sharp, and
 * returns the result. Transformed results are cached on disk so repeated
 * requests for the same transform are free.
 *
 * Transform parameters:
 *   w, h      — target dimensions
 *   fit       — cover, contain, fill, inside, outside, thumb
 *   crop      — auto, top, bottom, left, right, face, enclosed
 *   gravity   — face, auto, top, bottom, left, right
 *   fmt       — webp, avif, mozjpeg, png, gif
 *   quality   — 1-100
 *   dpi       — resolution scaling
 *   sharpen   — amount (1-10) or boolean (true = moderate)
 *   blur      — radius (1-100)
 *   grayscale — true
 *   sepia     — true
 *   rotate    — 0, 90, 180, 270
 *   flipH     — true
 *   flipV     — true
 *   padding   — border padding in px
 *   paddingColor — hex color
 */

export interface ImageTransforms {
  w?: number;
  h?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'thumb';
  crop?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'face' | 'enclosed';
  gravity?: 'face' | 'auto' | 'top' | 'bottom' | 'left' | 'right';
  fmt?: 'webp' | 'avif' | 'mozjpeg' | 'png' | 'gif';
  quality?: number;
  dpi?: number;
  sharpen?: number | boolean;
  blur?: number;
  grayscale?: boolean;
  sepia?: boolean;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  padding?: number;
  paddingColor?: string;
  [key: string]: unknown;
}

export interface TransformResult {
  body: Buffer;
  contentType: string;
  /** Cache key for this transform. */
  cacheKey: string;
  /** True when the result was served from cache. */
  cached: boolean;
}

const VALID_FITS = new Set(['cover', 'contain', 'fill', 'inside', 'outside', 'thumb']);
const VALID_FMTS = new Set(['webp', 'avif', 'mozjpeg', 'png', 'gif']);
const VALID_CROPS = new Set(['auto', 'top', 'bottom', 'left', 'right', 'face', 'enclosed']);
const VALID_GRAVITIES = new Set(['face', 'auto', 'top', 'bottom', 'left', 'right']);

/** Parse transform params from a URL query string. */
export function parseTransforms(query: Record<string, string | string[] | undefined>): ImageTransforms {
  const get = (key: string): string | undefined => {
    const v = query[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const bool = (key: string): boolean | undefined => {
    const v = get(key);
    if (v === undefined) return undefined;
    return v === 'true' || v === '1' || v === '';
  };
  const num = (key: string): number | undefined => {
    const v = get(key);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const transforms: ImageTransforms = {};

  const w = num('w');
  const h = num('h');
  if (w !== undefined) transforms.w = w;
  if (h !== undefined) transforms.h = h;

  const fit = get('fit');
  if (fit && VALID_FITS.has(fit)) transforms.fit = fit as ImageTransforms['fit'];

  const crop = get('crop');
  if (crop && VALID_CROPS.has(crop)) transforms.crop = crop as ImageTransforms['crop'];

  const gravity = get('gravity');
  if (gravity && VALID_GRAVITIES.has(gravity)) {
    transforms.gravity = gravity as ImageTransforms['gravity'];
  }

  const fmt = get('fmt');
  if (fmt && VALID_FMTS.has(fmt)) transforms.fmt = fmt as ImageTransforms['fmt'];

  const quality = num('quality');
  if (quality !== undefined) transforms.quality = Math.min(100, Math.max(1, quality));

  const dpi = num('dpi');
  if (dpi !== undefined) transforms.dpi = dpi;

  const sharpen = get('sharpen');
  if (sharpen !== undefined) {
    transforms.sharpen = sharpen === '' || sharpen === 'true' ? true : Number(sharpen);
  }

  const blur = num('blur');
  if (blur !== undefined) transforms.blur = blur;

  const grayscale = bool('grayscale');
  if (grayscale !== undefined) transforms.grayscale = grayscale;

  const sepia = bool('sepia');
  if (sepia !== undefined) transforms.sepia = sepia;

  const rotate = num('rotate');
  if (rotate !== undefined) transforms.rotate = rotate;

  const flipH = bool('flipH');
  if (flipH !== undefined) transforms.flipH = flipH;

  const flipV = bool('flipV');
  if (flipV !== undefined) transforms.flipV = flipV;

  const padding = num('padding');
  if (padding !== undefined) transforms.padding = padding;

  const paddingColor = get('paddingColor');
  if (paddingColor) transforms.paddingColor = paddingColor;

  return transforms;
}

/** Are there any transform params at all? */
export function hasTransforms(t: ImageTransforms): boolean {
  return Object.keys(t).length > 0;
}

/** Build a stable cache key from the original key + transform params. */
export function cacheKeyFor(originalKey: string, transforms: ImageTransforms): string {
  const normalized = JSON.stringify(transforms, (_, v) => (v === true ? '1' : v === false ? '0' : v));
  return createHash('sha256').update(`${originalKey}:${normalized}`).digest('hex').slice(0, 16);
}

/** Map format to content-type. */
function contentTypeFor(fmt: string | undefined): string {
  const map: Record<string, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
    mozjpeg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  };
  return map[fmt ?? ''] ?? 'image/jpeg';
}

/**
 * Apply transforms to an image buffer using sharp.
 * Returns the transformed buffer, content type, and cache key.
 */
export async function applyTransforms(
  original: Buffer,
  originalKey: string,
  transforms: ImageTransforms,
  cacheDir: string,
): Promise<TransformResult> {
  if (!hasTransforms(transforms)) {
    return { body: original, contentType: 'image/jpeg', cacheKey: '', cached: false };
  }

  const cacheKey = cacheKeyFor(originalKey, transforms);
  const cacheFile = join(cacheDir, cacheKey);

  // Check cache first.
  try {
    await access(cacheFile, constants.F_OK);
    const cached = await readFile(cacheFile);
    return {
      body: cached,
      contentType: contentTypeFor(transforms.fmt),
      cacheKey,
      cached: true,
    };
  } catch {
    // Not cached — proceed to transform.
  }

  // Lazy-load sharp (it's a native module, may not be installed).
  type SharpFn = (buf: Buffer, opts?: Record<string, unknown>) => {
    resize(opts: Record<string, unknown>): SharpFn;
    rotate(deg?: number): SharpFn;
    flop(): SharpFn;
    flip(): SharpFn;
    grayscale(): SharpFn;
    sepiate(): SharpFn;
    sharpen(opts: Record<string, unknown>): SharpFn;
    blur(radius: number): SharpFn;
    extend(opts: Record<string, unknown>): SharpFn;
    toBuffer(opts?: Record<string, unknown>): Promise<Buffer>;
  };

  let sharp: SharpFn | null = null;
  try {
    const mod = (await import('sharp')) as unknown as { default: SharpFn };
    sharp = mod.default;
  } catch {
    // sharp not installed — return original (transforms are a no-op).
    return { body: original, contentType: 'image/jpeg', cacheKey: '', cached: false };
  }

  const pipeline = sharp(original, {
    ...(transforms.dpi ? { density: transforms.dpi * 72 } : {}),
  });

  // Resize.
  const fit = transforms.fit ?? 'cover';
  if (transforms.w || transforms.h) {
    pipeline.resize({
      width: transforms.w,
      height: transforms.h,
      fit: fit as 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'thumb',
      ...(transforms.crop ? { position: transforms.crop as 'top' | 'bottom' | 'left' | 'right' | 'center' } : {}),
      ...(transforms.gravity ? { ...(transforms.crop === undefined ? { position: 'centre' } : {}) } : {}),
    });
  }

  // Rotation.
  if (transforms.rotate) pipeline.rotate(transforms.rotate);

  // Flips.
  if (transforms.flipH) pipeline.flop();
  if (transforms.flipV) pipeline.flip();

  // Color adjustments.
  if (transforms.grayscale) pipeline.grayscale();
  if (transforms.sepia) pipeline.sepiate();
  if (transforms.sharpen) {
    pipeline.sharpen({
      sigma: typeof transforms.sharpen === 'number' ? transforms.sharpen : 1.0,
    });
  }
  if (transforms.blur) pipeline.blur(transforms.blur);

  // Padding (border).
  if (transforms.padding) {
    pipeline.extend({
      top: transforms.padding,
      bottom: transforms.padding,
      left: transforms.padding,
      right: transforms.padding,
      background: transforms.paddingColor ?? { r: 0, g: 0, b: 0, alpha: 1 },
    });
  }

  // Format.
  const fmt = transforms.fmt ?? 'jpeg';
  const format = fmt === 'mozjpeg' ? 'jpeg' : fmt;

  const pipelineOpts: Record<string, unknown> = { format: format as 'jpeg' | 'png' | 'webp' | 'gif' };
  if ((fmt === 'jpeg' || fmt === 'mozjpeg' || fmt === 'webp') && transforms.quality) {
    pipelineOpts.quality = transforms.quality;
  }

  const output = await pipeline.toBuffer(pipelineOpts);

  // Write to cache.
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, output);
  } catch {
    // Cache write failure must never break the request.
  }

  return {
    body: output,
    contentType: contentTypeFor(fmt),
    cacheKey,
    cached: false,
  };
}

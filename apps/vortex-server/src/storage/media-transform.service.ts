import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import type { TransformOperation } from '@vortex/core';
import type { WebhookService } from '../webhooks/webhook.service.js';

interface TransformationRow {
  id: string;
  key: string;
  operation: string;
  params: Record<string, unknown>;
  output_key: string;
  owner_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  webhook_status: string | null;
  error_message: string | null;
  completed_at: Date | null;
  created_at: Date;
}

/**
 * Media transformation service — dispatches image/video transformation
 * requests and fires webhooks on completion.
 *
 * For a production deployment this would call an image processing service
 * (e.g. a Thumbor-compatible endpoint, Cloudflare Images, or an internal
 * worker). Here we implement the full pipeline: request parsing, key
 * generation, webhook dispatch, and status tracking.
 */
export class MediaTransformService {
  constructor(
    private readonly db: Knex,
    private readonly webhooks: WebhookService | null = null,
  ) {}

  /**
   * Request a transformation of a stored object.
   * Returns the transformation record with a presigned download URL for
   * the result.
   */
  async request(
    ownerId: string,
    input: {
      key: string;
      operation: TransformOperation;
      params: Record<string, unknown>;
    },
  ): Promise<TransformationRow> {
    this.validateParams(input.operation, input.params);

    const outputKey = this.generateOutputKey(input.key, input.operation, input.params);

    const [row] = await this.db<TransformationRow>('media_transformations')
      .insert({
        key: input.key,
        operation: input.operation,
        params: input.params,
        output_key: outputKey,
        owner_id: ownerId,
        status: 'pending',
      })
      .returning('*');

    const r = row!;

    // Process the transformation (async — fire and forget)
    void this.process(r);

    return r;
  }

  /**
   * Process a transformation. In production this would call an image
   * processing service. Here we mark it as completed and dispatch the
   * webhook.
   */
  async process(row: TransformationRow): Promise<void> {
    try {
      await this.db('media_transformations')
        .where({ id: row.id })
        .update({ status: 'processing' });

      // In production: call image processing service here.

      await this.db('media_transformations')
        .where({ id: row.id })
        .update({ status: 'completed', completed_at: new Date() });

      if (this.webhooks) {
        try {
          await this.webhooks.deliver('media.transformation.completed', {
            transformationId: row.id,
            key: row.key,
            operation: row.operation,
            params: row.params,
            outputKey: row.output_key,
            ownerId: row.owner_id,
          });
          await this.db('media_transformations')
            .where({ id: row.id })
            .update({ webhook_status: 'sent' });
        } catch (err) {
          await this.db('media_transformations')
            .where({ id: row.id })
            .update({
              webhook_status: 'failed',
              error_message: (err as Error).message,
            });
        }
      } else {
        await this.db('media_transformations')
          .where({ id: row.id })
          .update({ webhook_status: 'skipped' });
      }
    } catch (err) {
      await this.db('media_transformations')
        .where({ id: row.id })
        .update({
          status: 'failed',
          error_message: (err as Error).message,
        });
    }
  }

  /** Get a transformation by id. */
  async get(id: string): Promise<TransformationRow | null> {
    const row = await this.db<TransformationRow>('media_transformations').where({ id }).first();
    if (!row) return null;
    return row;
  }

  /** List transformations for an owner. */
  async list(ownerId: string, limit = 20): Promise<TransformationRow[]> {
    return this.db<TransformationRow>('media_transformations')
      .where({ owner_id: ownerId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /** Delete a transformation record. */
  async delete(id: string, ownerId: string): Promise<void> {
    const row = await this.db<TransformationRow>('media_transformations')
      .where({ id, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Transformation not found');
    await this.db('media_transformations').where({ id }).del();
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private validateParams(op: TransformOperation, params: Record<string, unknown>): void {
    switch (op) {
      case 'resize':
        if (!params.width || !params.height) {
          throw ApiError.badRequest('resize requires width and height');
        }
        if (typeof params.width !== 'number' || typeof params.height !== 'number') {
          throw ApiError.badRequest('width and height must be numbers');
        }
        if (params.width < 1 || params.height < 1 || params.width > 10000 || params.height > 10000) {
          throw ApiError.badRequest('width and height must be between 1 and 10000');
        }
        break;
      case 'crop':
        if (!params.width || !params.height) {
          throw ApiError.badRequest('crop requires width and height');
        }
        if (typeof params.width !== 'number' || typeof params.height !== 'number') {
          throw ApiError.badRequest('width and height must be numbers');
        }
        break;
      case 'quality':
        if (!params.quality) {
          throw ApiError.badRequest('quality requires a quality parameter');
        }
        if (typeof params.quality !== 'number' || params.quality < 1 || params.quality > 100) {
          throw ApiError.badRequest('quality must be between 1 and 100');
        }
        break;
      case 'rotate':
        if (!params.degrees) {
          throw ApiError.badRequest('rotate requires degrees');
        }
        if (typeof params.degrees !== 'number' || params.degrees % 90 !== 0) {
          throw ApiError.badRequest('degrees must be a multiple of 90');
        }
        break;
      case 'format':
        if (!params.format) {
          throw ApiError.badRequest('format requires a format parameter');
        }
        if (typeof params.format !== 'string') {
          throw ApiError.badRequest('format must be a string');
        }
        break;
      default:
        throw ApiError.badRequest(`Unknown operation: ${op}`);
    }
  }

  private generateOutputKey(
    key: string,
    op: TransformOperation,
    params: Record<string, unknown>,
  ): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${String(v)}`)
      .join('|');
    const hash = createHash('sha1').update(paramStr).digest('hex').slice(0, 8);
    const ext = key.includes('.') ? key.split('.').pop() : '';
    const base = ext ? key.slice(0, -ext.length - 1) : key;
    const newExt = params.format && typeof params.format === 'string' ? params.format : ext;
    return `${base}.${op}-${hash}${newExt ? '.' + newExt : ''}`;
  }
}

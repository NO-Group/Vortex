import type { Knex } from 'knex';
import type { VortexFunctionMeta } from '@vortex/core';
import { ApiError } from '../errors.js';
import {
  validateFunctionName,
  type VortexFunctionRow,
} from './functions.types.js';

function toMeta(row: VortexFunctionRow): VortexFunctionMeta {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    status: row.status,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Registry for Vortex Functions. */
export class FunctionsService {
  constructor(private readonly db: Knex) {}

  async create(
    ownerId: string,
    rawName: string,
    source: string,
    title?: string,
  ): Promise<VortexFunctionMeta> {
    let name: string;
    try {
      name = validateFunctionName(rawName);
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }
    if (!source.trim()) throw ApiError.badRequest('Function source is required');

    const existing = await this.db<VortexFunctionRow>('functions').where({ name }).first();
    if (existing) throw ApiError.conflict(`Function "${name}" already exists`);

    const [row] = await this.db<VortexFunctionRow>('functions')
      .insert({
        name,
        title: title?.trim() || name,
        source,
        owner_id: ownerId,
      })
      .returning('*');
    return toMeta(row!);
  }

  async list(userId: string, isAdmin: boolean): Promise<VortexFunctionMeta[]> {
    const query = this.db<VortexFunctionRow>('functions').orderBy('created_at', 'desc');
    if (!isAdmin) query.where({ owner_id: userId });
    return (await query).map(toMeta);
  }

  /** Fetch the deployable source for invocation (any owner — invoke is public). */
  async getForInvoke(name: string): Promise<VortexFunctionRow | null> {
    const row = await this.db<VortexFunctionRow>('functions').where({ name }).first();
    return row ?? null;
  }

  async requireOwned(name: string, userId: string, isAdmin: boolean): Promise<VortexFunctionRow> {
    const row = await this.db<VortexFunctionRow>('functions').where({ name }).first();
    if (!row) throw ApiError.notFound(`Function "${name}" not found`);
    if (!isAdmin && row.owner_id !== userId) {
      throw ApiError.forbidden('You do not own this function');
    }
    return row;
  }

  async update(
    name: string,
    userId: string,
    isAdmin: boolean,
    patch: { source?: string; title?: string; status?: 'active' | 'paused' },
  ): Promise<VortexFunctionMeta> {
    const row = await this.requireOwned(name, userId, isAdmin);
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (patch.source !== undefined) {
      if (!patch.source.trim()) throw ApiError.badRequest('Function source cannot be empty');
      updates.source = patch.source;
    }
    if (patch.title !== undefined) updates.title = patch.title.trim() || row.title;
    if (patch.status !== undefined) updates.status = patch.status;

    const [updated] = await this.db<VortexFunctionRow>('functions')
      .where({ id: row.id })
      .update(updates)
      .returning('*');
    return toMeta(updated!);
  }

  async remove(name: string, userId: string, isAdmin: boolean): Promise<void> {
    const row = await this.requireOwned(name, userId, isAdmin);
    await this.db('functions').where({ id: row.id }).del();
  }
}

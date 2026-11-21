import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import type { StorageDriver } from '../storage/storage.types.js';
import {
  contentTypeFor,
  resolveAppPath,
  validateAppName,
  type AppFileMeta,
  type AppMeta,
} from './apps.types.js';

interface AppRow {
  id: string;
  name: string;
  title: string;
  owner_id: string | null;
  created_at: Date;
}

interface AppFileRow {
  id: string;
  app_id: string;
  path: string;
  size: string | number;
  content_type: string;
  created_at: Date;
}

function toAppMeta(row: AppRow): AppMeta {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
  };
}

function toFileMeta(row: AppFileRow): AppFileMeta {
  return {
    id: row.id,
    appId: row.app_id,
    path: row.path,
    size: Number(row.size),
    contentType: row.content_type,
    createdAt: row.created_at.toISOString(),
  };
}

const storageKey = (appName: string, path: string) => `apps/${appName}/${path}`;

/** App registry + file persistence for Vortex Apps. */
export class AppsService {
  constructor(
    private readonly db: Knex,
    private readonly storage: StorageDriver,
  ) {}

  /** Create an app owned by `userId`. */
  async create(userId: string, rawName: string, title?: string): Promise<AppMeta> {
    let name: string;
    try {
      name = validateAppName(rawName);
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }

    const existing = await this.db<AppRow>('apps').where({ name }).first();
    if (existing) throw ApiError.conflict(`App "${name}" already exists`);

    const [row] = await this.db<AppRow>('apps')
      .insert({
        name,
        title: title?.trim() || name,
        owner_id: userId,
      })
      .returning('*');
    return toAppMeta(row!);
  }

  /** List apps owned by the user (admins see all). */
  async list(userId: string, isAdmin: boolean): Promise<AppMeta[]> {
    const query = this.db<AppRow>('apps').orderBy('created_at', 'desc');
    if (!isAdmin) query.where({ owner_id: userId });
    return (await query).map(toAppMeta);
  }

  /** Fetch one app by name (any owner — public metadata). */
  async get(name: string): Promise<AppMeta | null> {
    const row = await this.db<AppRow>('apps').where({ name }).first();
    return row ? toAppMeta(row) : null;
  }

  /** Assert the caller owns the app (admins pass). Returns the app. */
  async requireOwned(name: string, userId: string, isAdmin: boolean): Promise<AppMeta> {
    const app = await this.get(name);
    if (!app) throw ApiError.notFound(`App "${name}" not found`);
    if (!isAdmin && app.ownerId !== userId) {
      throw ApiError.forbidden('You do not own this app');
    }
    return app;
  }

  /** Delete an app, its registry rows, and its files. */
  async remove(name: string, userId: string, isAdmin: boolean): Promise<void> {
    const app = await this.requireOwned(name, userId, isAdmin);
    const files = await this.db<AppFileRow>('app_files').where({ app_id: app.id });
    for (const file of files) {
      await this.storage.delete(storageKey(name, file.path)).catch(() => undefined);
    }
    await this.db('app_files').where({ app_id: app.id }).del();
    await this.db('apps').where({ id: app.id }).del();
  }

  /** Upload (or replace) one file in an app. */
  async putFile(
    name: string,
    userId: string,
    isAdmin: boolean,
    rawPath: string,
    body: Buffer,
    contentType?: string,
  ): Promise<AppFileMeta> {
    const app = await this.requireOwned(name, userId, isAdmin);

    let path: string;
    try {
      path = resolveAppPath(rawPath);
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }

    const type = contentType ?? contentTypeFor(path);
    await this.storage.put({ key: storageKey(name, path), body, contentType: type });

    const [row] = await this.db<AppFileRow>('app_files')
      .insert({
        app_id: app.id,
        path,
        size: body.byteLength,
        content_type: type,
      })
      .onConflict(['app_id', 'path'])
      .merge({ size: body.byteLength, content_type: type })
      .returning('*');
    return toFileMeta(row!);
  }

  /** List the files of an app. */
  async listFiles(name: string): Promise<AppFileMeta[]> {
    const app = await this.get(name);
    if (!app) throw ApiError.notFound(`App "${name}" not found`);
    const rows = await this.db<AppFileRow>('app_files')
      .where({ app_id: app.id })
      .orderBy('path', 'asc');
    return rows.map(toFileMeta);
  }

  /** Remove one file from an app. */
  async removeFile(
    name: string,
    userId: string,
    isAdmin: boolean,
    rawPath: string,
  ): Promise<void> {
    const app = await this.requireOwned(name, userId, isAdmin);
    const path = resolveAppPath(rawPath);
    await this.storage.delete(storageKey(name, path)).catch(() => undefined);
    await this.db('app_files').where({ app_id: app.id, path }).del();
  }

  /**
   * Public read: resolve a URL path to file bytes for serving.
   * Falls back to `index.html` for extension-less paths (SPA routing).
   */
  async readPublic(
    name: string,
    rawPath: string,
  ): Promise<{ body: Buffer; contentType: string; path: string } | null> {
    const app = await this.get(name);
    if (!app) return null;

    let path: string;
    try {
      path = resolveAppPath(rawPath);
    } catch {
      return null;
    }

    const attempt = async (p: string) => {
      const meta = await this.db<AppFileRow>('app_files')
        .where({ app_id: app.id, path: p })
        .first();
      if (!meta) return null;
      try {
        const object = await this.storage.get(storageKey(name, p));
        return {
          body: object.body,
          contentType: meta.content_type || contentTypeFor(p),
          path: p,
        };
      } catch {
        return null;
      }
    };

    const direct = await attempt(path);
    if (direct) return direct;

    // SPA fallback: extension-less routes render index.html
    if (!path.includes('.')) {
      return attempt('index.html');
    }
    return null;
  }
}

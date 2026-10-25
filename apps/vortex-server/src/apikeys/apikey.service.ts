import type { Knex } from 'knex';
import crypto from 'node:crypto';

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[] | null;
  last_used_at: Date | string | null;
  created_at: Date | string;
  revoked_at: Date | string | null;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string;      // full key — shown once at creation
  key_prefix: string;
  scopes: string[] | null;
  created_at: Date | string;
}

export interface ApiKeyService {
  create(
    userId: string,
    name: string,
    scopes?: string[],
  ): Promise<ApiKeyCreateResult>;
  list(userId: string): Promise<ApiKey[]>;
  revoke(userId: string, apiKeyId: string): Promise<boolean>;
  validate(
    key: string,
  ): Promise<{ userId: string; scopes: string[] | null } | null>;
  touch(keyHash: string): Promise<void>;
}

export function createApiKeyService(db: Knex): ApiKeyService {
  const HASH_ALGORITHM = 'sha256';
  const KEY_PREFIX = 'vortex_live_';
  const KEY_LENGTH = 48; // hex chars after prefix

  function generateKey(): string {
    return KEY_PREFIX + crypto.randomBytes(KEY_LENGTH / 2).toString('hex');
  }

  function hashKey(key: string): string {
    return crypto.createHash(HASH_ALGORITHM).update(key).digest('hex');
  }

  return {
    async create(userId, name, scopes: string[] | null = null) {
      const key = generateKey();
      const keyHash = hashKey(key);
      const keyPrefix = key.slice(0, KEY_PREFIX.length + 8); // vortex_live_ + first 8 hex

      const [row] = await db('vortex_api_keys').insert({
        user_id: userId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes: scopes ?? null,
      }).returning(['id', 'name', 'key_prefix', 'scopes', 'created_at']);

      return {
        id: row.id,
        name: row.name,
        key,
        key_prefix: row.key_prefix,
        scopes: row.scopes,
        created_at: row.created_at,
      };
    },

    async list(userId) {
      return db('vortex_api_keys')
        .select('id', 'user_id', 'name', 'key_prefix', 'scopes', 'last_used_at', 'created_at', 'revoked_at')
        .where('user_id', userId)
        .whereNull('revoked_at')
        .orderBy('created_at', 'desc');
    },

    async revoke(userId, apiKeyId) {
      const result = await db('vortex_api_keys')
        .where('id', apiKeyId)
        .where('user_id', userId)
        .whereNull('revoked_at')
        .update({ revoked_at: db.fn.now() });
      return result > 0;
    },

    async validate(key) {
      if (!key || !key.startsWith(KEY_PREFIX)) return null;
      const keyHash = hashKey(key);

      const row = await db('vortex_api_keys')
        .select('user_id', 'scopes')
        .where('key_hash', keyHash)
        .whereNull('revoked_at')
        .first();

      if (!row) return null;
      return { userId: row.user_id, scopes: row.scopes };
    },

    async touch(keyHash) {
      await db('vortex_api_keys')
        .where('key_hash', keyHash)
        .update({ last_used_at: db.fn.now() });
    },
  };
}

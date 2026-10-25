import type { Knex } from 'knex';
import crypto from 'node:crypto';

export interface FeatureFlag {
  id: string;
  user_id: string;
  key: string;
  description: string | null;
  status: 'off' | 'on' | 'gradual';
  rollout_percentage: number | null;
  targeting: Record<string, unknown> | null;
  variants: Array<Record<string, unknown>> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  variant?: string | null;
  reason: 'on' | 'off' | 'gradual_in' | 'gradual_out' | 'targeted_out' | 'not_found';
}

export interface FeatureFlagService {
  create(
    userId: string,
    input: {
      key: string;
      description?: string;
      status?: 'off' | 'on' | 'gradual';
      rolloutPercentage?: number;
      targeting?: Record<string, unknown>;
      variants?: Array<Record<string, unknown>>;
    },
  ): Promise<FeatureFlag>;
  list(userId: string): Promise<FeatureFlag[]>;
  update(userId: string, flagId: string, input: Partial<FeatureFlag>): Promise<FeatureFlag | null>;
  delete(userId: string, flagId: string): Promise<boolean>;
  evaluate(
    key: string,
    userId: string,
    role?: string,
  ): Promise<FlagEvaluation>;
  evaluateAll(userId: string, role?: string): Promise<Record<string, boolean>>;
}

/** Deterministic hash for stable percentage bucketing. */
function hashBucket(userId: string, key: string): number {
  const hash = crypto.createHash('md5').update(`${key}:${userId}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) % 100;
}

export function createFeatureFlagService(db: Knex): FeatureFlagService {
  return {
    async create(userId, input) {
      const [row] = await db('vortex_feature_flags').insert({
        user_id: userId,
        key: input.key,
        description: input.description ?? null,
        status: input.status ?? 'off',
        rollout_percentage: input.rolloutPercentage ?? null,
        targeting: input.targeting ?? null,
        variants: input.variants ?? null,
      }).returning('*');
      return row;
    },

    async list(userId) {
      return db('vortex_feature_flags')
        .select('*')
        .where('user_id', userId)
        .orderBy('key', 'asc');
    },

    async update(userId, flagId, input) {
      const allowed = ['description', 'status', 'rollout_percentage', 'targeting', 'variants'];
      const update: Record<string, unknown> = {};
      for (const field of allowed) {
        if (field in input) {
          update[field] = input[field as keyof FeatureFlag];
        }
      }
      update.updated_at = new Date();

      const result = await db('vortex_feature_flags')
        .where({ id: flagId, user_id: userId })
        .update(update)
        .returning('*');
      return result[0] ?? null;
    },

    async delete(userId, flagId) {
      const result = await db('vortex_feature_flags')
        .where({ id: flagId, user_id: userId })
        .delete();
      return result > 0;
    },

    async evaluate(key, userId, role = 'user') {
      const flag = await db('vortex_feature_flags')
        .where('key', key)
        .first();

      if (!flag) {
        return { key, enabled: false, reason: 'not_found' };
      }

      // Check targeting rules
      if (flag.targeting) {
        const allowedRoles = flag.targeting.roles as string[] | undefined;
        if (allowedRoles && !allowedRoles.includes(role)) {
          return { key, enabled: false, reason: 'targeted_out' };
        }
        const allowedUsers = flag.targeting.userIds as string[] | undefined;
        if (allowedUsers && !allowedUsers.includes(userId)) {
          return { key, enabled: false, reason: 'targeted_out' };
        }
      }

      // Evaluate status
      if (flag.status === 'off') {
        return { key, enabled: false, reason: 'off' };
      }

      if (flag.status === 'on') {
        const variant = flag.variants?.[0]?.name as string | undefined;
        return { key, enabled: true, variant: variant ?? null, reason: 'on' };
      }

      // Gradual rollout
      if (flag.status === 'gradual') {
        const percentage = flag.rollout_percentage ?? 0;
        const bucket = hashBucket(userId, key);
        if (bucket < percentage) {
          const variant = flag.variants?.[0]?.name as string | undefined;
          return { key, enabled: true, variant: variant ?? null, reason: 'gradual_in' };
        }
        return { key, enabled: false, reason: 'gradual_out' };
      }

      return { key, enabled: false, reason: 'off' };
    },

    async evaluateAll(userId, role = 'user') {
      const flags = await db('vortex_feature_flags')
        .select('key')
        .where('user_id', userId);

      const results: Record<string, boolean> = {};
      for (const flag of flags) {
        const eval_ = await this.evaluate(flag.key, userId, role);
        results[flag.key] = eval_.enabled;
      }
      return results;
    },
  };
}

import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { createTwoFactorService } from './twofactor.service.js';
import { OneTimeTokens } from './one-time-tokens.js';
import { AuthService } from './auth.service.js';
import { verifyPassword } from './passwords.js';
import type { TokenConfig } from './tokens.js';

const setupSchema = z.object({});

const enableSchema = z.object({
  code: z.string().min(6).max(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const verifySchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(1).max(10),
});

const disableSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(1).max(10),
});

/** `/v1/auth/2fa` — two-factor authentication setup and verification. */
export function createTwoFactorRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const twoFactor = createTwoFactorService();
  const oneTimeTokens = new OneTimeTokens(ctx.db);
  const authService = new AuthService(ctx.db, ctx.env.jwt as TokenConfig, {
    devLinks: ctx.env.devLinks,
    publicAppUrl: ctx.env.publicAppUrl,
    mailer: undefined,
  });

  /** POST /v1/auth/2fa/setup — begin 2FA enrollment (requires auth). */
  router.post('/setup', auth, validateBody(setupSchema), async (req, res, next) => {
    try {
      const userId = req.auth!.sub;
      const user = await ctx.db('users').where({ id: userId }).first();
      if (!user) throw ApiError.unauthorized();

      // Generate secret and store
      const secret = twoFactor.generateSecret();
      await ctx.db('users').where({ id: userId }).update({
        two_factor_secret: secret,
      });

      // Generate backup codes
      const backupCodes = twoFactor.generateBackupCodes();
      const backupHashes = twoFactor.hashBackupCodes(backupCodes);
      await ctx.db('users').where({ id: userId }).update({
        two_factor_backup_codes: backupHashes,
      });

      const otpauthUrl = twoFactor.getOtpauthUrl(
        secret,
        user.email,
        'Vortex',
      );

      res.json({
        secret,
        otpauthUrl,
        backupCodes,
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/2fa/enable — confirm 2FA enrollment (requires auth). */
  router.post('/enable', auth, validateBody(enableSchema), async (req, res, next) => {
    try {
      const userId = req.auth!.sub;
      const user = await ctx.db('users').where({ id: userId }).first();
      if (!user || !user.two_factor_secret) {
        throw ApiError.badRequest('Run 2FA setup first');
      }

      // Try TOTP code first, then backup codes
      const { code } = req.body;
      const backupHashes = (user.two_factor_backup_codes as string[] | null) ?? [];
      const remainingBackups = twoFactor.verifyBackupCode(backupHashes, code);

      if (remainingBackups === null && !twoFactor.verifyCode(user.two_factor_secret, code)) {
        throw ApiError.badRequest('Invalid code');
      }

      await ctx.db('users').where({ id: userId }).update({
        two_factor_enabled: true,
      });

      // If backup code was used, store remaining hashes
      if (remainingBackups !== null) {
        await ctx.db('users').where({ id: userId }).update({
          two_factor_backup_codes: backupHashes.filter(() => false), // removed used one
        });
      }

      res.json({ enabled: true });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/2fa/verify — complete 2FA login (public, uses tempToken). */
  router.post('/verify', validateBody(verifySchema), async (req, res, next) => {
    try {
      const { tempToken, code } = req.body;

      // Consume the temp token
      const userId = await oneTimeTokens.consume(tempToken, '2fa');
      if (!userId) {
        throw ApiError.unauthorized('Invalid or expired verification token');
      }

      const user = await ctx.db('users').where({ id: userId }).first();
      if (!user) throw ApiError.unauthorized();

      // Try TOTP code first, then backup codes
      const backupHashes = (user.two_factor_backup_codes as string[] | null) ?? [];
      const remainingBackups = twoFactor.verifyBackupCode(backupHashes, code);

      if (remainingBackups === null && !twoFactor.verifyCode(user.two_factor_secret ?? '', code)) {
        throw ApiError.badRequest('Invalid code');
      }

      // If backup code was used, store remaining hashes
      if (remainingBackups !== null) {
        await ctx.db('users').where({ id: userId }).update({
          two_factor_backup_codes: backupHashes.slice(0, -1),
        });
      }

      // Issue session
      const session = await authService.issueSessionForUser(user.id);
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/2fa/disable — disable 2FA (requires auth + password). */
  router.post('/disable', auth, validateBody(disableSchema), async (req, res, next) => {
    try {
      const userId = req.auth!.sub;
      const user = await ctx.db('users').where({ id: userId }).first();
      if (!user || !user.two_factor_enabled) {
        throw ApiError.badRequest('2FA is not enabled');
      }

      // Verify password
      const passwordValid = await verifyPassword(req.body.password, user.password_hash);
      if (!passwordValid) {
        throw ApiError.unauthorized('Invalid password');
      }

      // Verify 2FA code (TOTP or backup)
      const backupHashes = (user.two_factor_backup_codes as string[] | null) ?? [];
      const remainingBackups = twoFactor.verifyBackupCode(backupHashes, req.body.code);

      if (remainingBackups === null && !twoFactor.verifyCode(user.two_factor_secret ?? '', req.body.code)) {
        throw ApiError.badRequest('Invalid code');
      }

      await ctx.db('users').where({ id: userId }).update({
        two_factor_secret: null,
        two_factor_enabled: false,
        two_factor_backup_codes: null,
      });

      res.json({ disabled: true });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/2fa/backup-codes — regenerate backup codes (requires auth). */
  router.post('/backup-codes', auth, async (req, res, next) => {
    try {
      const userId = req.auth!.sub;
      const backupCodes = twoFactor.generateBackupCodes();
      const backupHashes = twoFactor.hashBackupCodes(backupCodes);

      await ctx.db('users').where({ id: userId }).update({
        two_factor_backup_codes: backupHashes,
      });

      res.json({ backupCodes });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import type { Knex } from 'knex';
import { randomUUID, generateKeyPairSync, createHash, timingSafeEqual, createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ApiError } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signToken, type TokenConfig } from './tokens.js';
import {
  parseScopes,
  scopesToString,
  type OAuthClient,
  type OAuthClientCreateInput,
  type AuthCode,
  type OidcKey,
  type TokenResponse,
  type IdTokenClaims,
  type Jwk,
  type OidcDiscovery,
} from './oidc.types.js';

interface ClientRow {
  id: string;
  client_id: string;
  client_secret_hash: string;
  name: string;
  description: string | null;
  redirect_uris: string;
  scopes: string;
  grant_types: string;
  logo_url: string | null;
  website_url: string | null;
  enabled: boolean;
  app_id: string | null;
  owner_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CodeRow {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  nonce: string | null;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
}

interface KeyRow {
  id: string;
  kid: string;
  private_key: string;
  public_key: string;
  alg: string;
  active: boolean;
  created_at: Date | string;
  expires_at: Date | string | null;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

function toClient(row: ClientRow): OAuthClient {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    redirectUris: JSON.parse(row.redirect_uris) as string[],
    scopes: parseScopes(row.scopes),
    grantTypes: parseScopes(row.grant_types),
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    enabled: row.enabled,
    appId: row.app_id,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toAuthCode(row: CodeRow): AuthCode {
  return {
    code: row.code,
    clientId: row.client_id,
    userId: row.user_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    nonce: row.nonce,
    expiresAt: new Date(row.expires_at).toISOString(),
    usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
  };
}

function toKey(row: KeyRow): OidcKey {
  return {
    kid: row.kid,
    privateKey: row.private_key,
    publicKey: row.public_key,
    alg: row.alg,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

/**
 * OIDC Provider service.
 *
 * Manages OAuth clients, authorization codes, JWKS keys, and
 * issues ID tokens for external applications.
 */
export class OidcService {
  private tokenConfig: TokenConfig;
  private issuer: string;
  private publicAppUrl: string;
  private cachedKey: OidcKey | null = null;

  constructor(
    private readonly db: Knex,
    tokenConfig: TokenConfig,
    opts: { publicAppUrl: string },
  ) {
    this.tokenConfig = tokenConfig;
    this.issuer = tokenConfig.issuer;
    this.publicAppUrl = opts.publicAppUrl.replace(/\/+$/, '');
  }

  // ── Client Management ─────────────────────────────────────────────────

  async createClient(
    ownerId: string,
    input: OAuthClientCreateInput,
    preGeneratedSecret?: string,
  ): Promise<OAuthClient> {
    const clientId = `vortex_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const clientSecret = preGeneratedSecret ?? randomUUID();
    const secretHash = await hashPassword(clientSecret);

    const [row] = await this.db<ClientRow>('vortex_oauth_clients')
      .insert({
        client_id: clientId,
        client_secret_hash: secretHash,
        name: input.name,
        description: input.description ?? null,
        redirect_uris: JSON.stringify(input.redirectUris),
        scopes: scopesToString(input.scopes ?? ['openid', 'profile', 'email']),
        grant_types: scopesToString(input.grantTypes ?? ['authorization_code', 'refresh_token']),
        logo_url: input.logoUrl ?? null,
        website_url: input.websiteUrl ?? null,
        enabled: true,
        owner_id: ownerId,
      })
      .returning('*');

    return toClient(row!);
  }

  async listClients(ownerId: string, isAdmin: boolean): Promise<OAuthClient[]> {
    const query = this.db<ClientRow>('vortex_oauth_clients').orderBy('created_at', 'desc');
    if (!isAdmin) query.where({ owner_id: ownerId });
    const rows = await query;
    return rows.map(toClient);
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const row = await this.db<ClientRow>('vortex_oauth_clients')
      .where({ client_id: clientId })
      .first();
    return row ? toClient(row) : null;
  }

  async requireClient(clientId: string): Promise<OAuthClient> {
    const client = await this.getClient(clientId);
    if (!client) throw ApiError.notFound(`Client \"${clientId}\" not found`);
    if (!client.enabled) throw ApiError.forbidden(`Client \"${clientId}\" is disabled`);
    return client;
  }

  async verifyClientSecret(clientId: string, clientSecret: string): Promise<OAuthClient> {
    const row = await this.db<ClientRow>('vortex_oauth_clients')
      .where({ client_id: clientId })
      .first();
    if (!row) throw ApiError.unauthorized('Invalid client credentials');
    if (!row.enabled) throw ApiError.forbidden(`Client \"${clientId}\" is disabled`);

    // Verify the secret against the stored hash
    const valid = await verifyPassword(clientSecret, row.client_secret_hash);
    if (!valid) throw ApiError.unauthorized('Invalid client credentials');

    return toClient(row);
  }

  async updateClient(
    clientId: string,
    ownerId: string,
    isAdmin: boolean,
    patch: Partial<OAuthClientCreateInput>,
  ): Promise<OAuthClient> {
    const client = await this.requireClient(clientId);
    if (!isAdmin && client.ownerId !== ownerId) {
      throw ApiError.forbidden('You do not own this client');
    }

    const updates: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.redirectUris !== undefined) {
      updates.redirect_uris = JSON.stringify(patch.redirectUris);
    }
    if (patch.scopes !== undefined) {
      updates.scopes = scopesToString(patch.scopes);
    }
    if (patch.grantTypes !== undefined) {
      updates.grant_types = scopesToString(patch.grantTypes);
    }
    if (patch.logoUrl !== undefined) updates.logo_url = patch.logoUrl;
    if (patch.websiteUrl !== undefined) updates.website_url = patch.websiteUrl;

    const [row] = await this.db<ClientRow>('vortex_oauth_clients')
      .where({ id: client.id })
      .update(updates)
      .returning('*');
    return toClient(row!);
  }

  async removeClient(clientId: string, ownerId: string, isAdmin: boolean): Promise<void> {
    const client = await this.requireClient(clientId);
    if (!isAdmin && client.ownerId !== ownerId) {
      throw ApiError.forbidden('You do not own this client');
    }
    await this.db('vortex_oauth_clients').where({ id: client.id }).del();
    await this.db('vortex_oauth_auth_codes').where({ client_id: clientId }).del();
  }

  // ── Authorization Codes ───────────────────────────────────────────────

  async createAuthCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scope: string,
    codeChallenge: string | null,
    codeChallengeMethod: string | null,
    nonce: string | null,
  ): Promise<AuthCode> {
    const client = await this.requireClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) {
      throw ApiError.badRequest('Invalid redirect_uri');
    }

    const code = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const [row] = await this.db<CodeRow>('vortex_oauth_auth_codes')
      .insert({
        code,
        client_id: clientId,
        user_id: userId,
        redirect_uri: redirectUri,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        nonce,
        expires_at: expiresAt,
      })
      .returning('*');

    return toAuthCode(row!);
  }

  async exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string | null,
    redirectUri: string,
    codeVerifier: string | null,
  ): Promise<{ user: UserRow; scope: string; nonce: string | null; codeChallenge: string | null; codeChallengeMethod: string | null }> {
    const client = await this.requireClient(clientId);

    // If client has a secret, verify it
    if (clientSecret) {
      const verified = await this.verifyClientSecret(clientId, clientSecret);
      void verified;
    }

    const [row] = await this.db<CodeRow>('vortex_oauth_auth_codes')
      .where({ code })
      .limit(1);

    if (!row) throw ApiError.badRequest('Invalid authorization code');
    if (row.used_at) throw ApiError.badRequest('Authorization code already used');
    if (row.client_id !== clientId) throw ApiError.badRequest('Code does not match client');
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw ApiError.badRequest('Authorization code expired');
    }
    if (row.redirect_uri !== redirectUri) {
      throw ApiError.badRequest('redirect_uri mismatch');
    }

    // PKCE verification
    if (row.code_challenge) {
      if (!codeVerifier) {
        throw ApiError.badRequest('PKCE code_verifier required');
      }
      let computedChallenge: string;
      if (row.code_challenge_method === 'S256') {
        computedChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
      } else {
        computedChallenge = codeVerifier;
      }
      const challengeBuf = Buffer.from(row.code_challenge);
      const computedBuf = Buffer.from(computedChallenge);
      if (challengeBuf.length !== computedBuf.length || !timingSafeEqual(challengeBuf, computedBuf)) {
        throw ApiError.badRequest('PKCE verification failed');
      }
    }

    // Mark code as used
    await this.db('vortex_oauth_auth_codes')
      .where({ id: row.id })
      .update({ used_at: this.db.fn.now() });

    // Get the user
    const user = await this.db<UserRow>('users').where({ id: row.user_id }).first();
    if (!user) throw ApiError.notFound('User not found');

    return {
      user,
      scope: row.scope,
      nonce: row.nonce,
      codeChallenge: row.code_challenge,
      codeChallengeMethod: row.code_challenge_method,
    };
  }

  // ── JWKS Key Management ──────────────────────────────────────────────

  /** Ensure a key pair exists; returns the active key. */
  async ensureKey(): Promise<OidcKey> {
    if (this.cachedKey) return this.cachedKey;

    const existing = await this.db<KeyRow>('vortex_oidc_keys')
      .where({ active: true })
      .orderBy('created_at', 'desc')
      .first();
    if (existing) {
      this.cachedKey = toKey(existing);
      return this.cachedKey;
    }

    // Generate a new RSA key pair
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    const kid = `vortex-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const [row] = await this.db<KeyRow>('vortex_oidc_keys')
      .insert({
        kid,
        private_key: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
        public_key: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        alg: 'RS256',
        active: true,
      })
      .returning('*');

    const key = toKey(row!);
    this.cachedKey = key;
    return key;
  }

  /** Get the JWKS response with public keys. */
  async getJwks(): Promise<{ keys: Jwk[] }> {
    const key = await this.ensureKey();

    // Extract modulus (n) and exponent (e) from the public key
    const jwk = this.pemToJwk(key.publicKey, key.kid, key.alg);
    return { keys: [jwk] };
  }

  /** Convert a PEM public key to JWK format. */
  private pemToJwk(pem: string, kid: string, alg: string): Jwk {
    const publicKeyObj = createPublicKey(pem);
    const jwkFromKey = publicKeyObj.export({ format: 'jwk' }) as { n: string; e: string };

    return {
      kid,
      kty: 'RSA',
      use: 'sig',
      alg,
      n: jwkFromKey.n,
      e: jwkFromKey.e,
    };
  }

  // ── Token Issuance ───────────────────────────────────────────────────

  /** Issue an ID token (JWT) for the authenticated user. */
  issueIdToken(
    user: UserRow,
    clientId: string,
    scope: string,
    nonce: string | null,
  ): string {
    const key = this.cachedKey!;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;

    const claims: IdTokenClaims = {
      iss: this.issuer,
      sub: user.id,
      aud: clientId,
      exp: now + expiresIn,
      iat: now,
      auth_time: now,
      nonce,
      email: user.email,
      email_verified: true,
      name: (user.metadata?.name as string) ?? null,
      picture: (user.metadata?.picture as string) ?? null,
      role: user.role,
    };

    return jwt.sign(claims, key.privateKey, {
      algorithm: 'RS256',
      keyid: key.kid,
    });
  }

  /** Issue an access token (Vortex JWT). */
  issueAccessToken(user: UserRow, scope: string): string {
    return signToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role as 'user' | 'admin',
        meta: { scope, ...(user.metadata ?? {}) },
      },
      this.tokenConfig,
    );
  }

  /** Issue a refresh token. */
  issueRefreshToken(user: UserRow, clientId: string): string {
    const refreshToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    return refreshToken;
  }

  /** Build the complete token response. */
  async buildTokenResponse(
    user: UserRow,
    clientId: string,
    scope: string,
    nonce: string | null,
    includeRefreshToken = false,
  ): Promise<TokenResponse> {
    // Ensure the key is ready
    await this.ensureKey();

    const accessToken = this.issueAccessToken(user, scope);
    const idToken = this.issueIdToken(user, clientId, scope, nonce);

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken,
      scope,
    };

    if (includeRefreshToken) {
      response.refresh_token = this.issueRefreshToken(user, clientId);
    }

    return response;
  }

  // ── Discovery ──────────────────────────────────────────────────────

  getDiscovery(): OidcDiscovery {
    const base = this.publicAppUrl;
    return {
      issuer: this.issuer,
      authorization_endpoint: `${base}/v1/auth/oidc/authorize`,
      token_endpoint: `${base}/v1/auth/oidc/token`,
      userinfo_endpoint: `${base}/v1/auth/oidc/userinfo`,
      jwks_uri: `${base}/v1/auth/oidc/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
    };
  }

  /** Pre-load the key for sync operations. */
  async preloadKey(): Promise<void> {
    this.cachedKey = await this.ensureKey();
  }
}

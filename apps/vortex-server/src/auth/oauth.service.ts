import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import { hashPassword } from './passwords.js';
import { signToken, type TokenConfig } from './tokens.js';
import { OAUTH_PROVIDERS, type OAuthProvider, type OAuthAccount, type OAuthResult } from './oauth.types.js';

interface ProviderRow {
  id: string;
  name: string;
  display_name: string;
  client_id: string;
  client_secret: string;
  auth_url: string;
  token_url: string;
  userinfo_url: string;
  scopes: string;
  extra: Record<string, unknown> | null;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AccountRow {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string | null;
  profile: Record<string, unknown> | null;
  linked_at: Date | string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toProvider(row: ProviderRow): OAuthProvider {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    authUrl: row.auth_url,
    tokenUrl: row.token_url,
    userinfoUrl: row.userinfo_url,
    scopes: row.scopes,
    extra: row.extra ?? null,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toAccount(row: AccountRow): OAuthAccount {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    providerEmail: row.provider_email,
    profile: row.profile ?? null,
    linkedAt: new Date(row.linked_at).toISOString(),
  };
}

/**
 * OAuth service — manage providers and handle the OAuth login flow.
 *
 * Flow:
 *   1. GET /v1/auth/oauth/:provider/start → redirect to provider's authorize URL
 *   2. Provider redirects to GET /v1/auth/oauth/:provider/callback?code=...
 *   3. Service exchanges code for access token, fetches userinfo
 *   4. Finds existing Vortex user by email or linked provider account
 *   5. Creates new user if none exists
 *   6. Returns a Vortex session (JWT)
 */
export class OAuthService {
  constructor(
    private readonly db: Knex,
    private readonly tokenConfig: TokenConfig,
    private readonly opts: { publicAppUrl: string },
  ) {}

  // ── Provider management (admin) ───────────────────────────────────────

  /** List all configured providers. */
  async listProviders(): Promise<OAuthProvider[]> {
    const rows = await this.db<ProviderRow>('vortex_oauth_providers').orderBy('name');
    return rows.map(toProvider);
  }

  /** Get a single provider by name. */
  async getProvider(name: string): Promise<OAuthProvider | null> {
    const row = await this.db<ProviderRow>('vortex_oauth_providers').where({ name }).first();
    return row ? toProvider(row) : null;
  }

  /** Create or update a provider (upsert by name). */
  async upsertProvider(input: {
    name: string;
    clientId: string;
    clientSecret: string;
    scopes?: string;
    extra?: Record<string, unknown>;
    enabled?: boolean;
    displayName?: string;
  }): Promise<OAuthProvider> {
    const def = OAUTH_PROVIDERS[input.name];
    if (!def) {
      throw ApiError.badRequest(`Unknown OAuth provider: "${input.name}"`);
    }

    const existing = await this.db<ProviderRow>('vortex_oauth_providers')
      .where({ name: input.name }).first();

    if (existing) {
      const [row] = await this.db<ProviderRow>('vortex_oauth_providers')
        .where({ id: existing.id })
        .update({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          scopes: input.scopes ?? existing.scopes,
          extra: input.extra ?? existing.extra,
          enabled: input.enabled ?? existing.enabled,
          display_name: input.displayName ?? existing.display_name,
          updated_at: this.db.fn.now(),
        })
        .returning('*');
      return toProvider(row!);
    }

    const [row] = await this.db<ProviderRow>('vortex_oauth_providers')
      .insert({
        name: input.name,
        display_name: input.displayName ?? def.displayName,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        auth_url: def.authUrl,
        token_url: def.tokenUrl,
        userinfo_url: def.userinfoUrl,
        scopes: input.scopes ?? def.scopes,
        extra: input.extra ?? null,
        enabled: input.enabled ?? true,
      })
      .returning('*');

    return toProvider(row!);
  }

  /** Remove a provider (and its linked accounts). */
  async removeProvider(name: string): Promise<void> {
    const provider = await this.getProvider(name);
    if (!provider) throw ApiError.notFound(`Provider "${name}" not found`);
    await this.db('vortex_oauth_accounts').where({ provider: name }).del();
    await this.db('vortex_oauth_providers').where({ id: provider.id }).del();
  }

  // ── OAuth flow ─────────────────────────────────────────────────────────

  /** Build the authorize URL to redirect the user to the provider. */
  async getAuthorizeUrl(providerName: string, redirectUri: string, state: string): Promise<string> {
    const provider = await this.getProvider(providerName);
    if (!provider) throw ApiError.notFound(`Provider "${providerName}" not configured`);
    if (!provider.enabled) throw ApiError.badRequest(`Provider "${providerName}" is disabled`);

    const def = OAUTH_PROVIDERS[providerName];
    if (!def) throw ApiError.badRequest(`Unknown provider: "${providerName}"`);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes,
      state,
    });

    // Provider-specific params
    if (providerName === 'apple' && provider.extra?.key_id) {
      params.set('key_id', String(provider.extra.key_id));
      params.set('response_mode', 'form_post');
    }

    return `${provider.authUrl}?${params}`;
  }

  /**
   * Exchange an authorization code for a Vortex session.
   * This is the callback handler — it receives the code from the provider
   * redirect and returns a session (or throws).
   */
  async handleCallback(
    providerName: string,
    code: string,
    redirectUri: string,
  ): Promise<OAuthResult> {
    const provider = await this.getProvider(providerName);
    if (!provider) throw ApiError.notFound(`Provider "${providerName}" not configured`);

    // 1. Exchange code for access token.
    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        ...(providerName === 'github' ? { authorization: `Bearer ${provider.clientId}` } : {}),
      },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw ApiError.unauthorized(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokenBody = (await tokenRes.json()) as Record<string, unknown>;
    const accessToken = tokenBody.access_token as string | undefined;
    if (!accessToken) {
      throw ApiError.unauthorized('Provider did not return an access token');
    }

    // 2. Fetch user profile.
    const profileRes = await fetch(provider.userinfoUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });

    if (!profileRes.ok) {
      throw ApiError.unauthorized(`Profile fetch failed: ${profileRes.status}`);
    }

    const profile = (await profileRes.json()) as Record<string, unknown>;
    const providerUserId = String(
      profile.sub ?? profile.id ?? profile.userId ?? profile.email ?? '',
    );
    const providerEmail = (profile.email as string | undefined)?.toLowerCase() ?? null;
    const name = (profile.name as string | undefined) ?? (profile.display_name as string | undefined) ?? null;

    if (!providerUserId) {
      throw ApiError.unauthorized('Provider did not return a user ID');
    }

    // 3. Find existing Vortex user.
    //    a) By linked provider account
    const [linked] = await this.db<AccountRow>('vortex_oauth_accounts')
      .where({ provider: providerName, provider_user_id: providerUserId })
      .limit(1);

    let userRow: UserRow | undefined = linked
      ? await this.db<UserRow>('users').where({ id: linked.user_id }).first()
      : undefined;

    //    b) By email (if the email matches an existing account)
    if (!userRow && providerEmail) {
      userRow = await this.db<UserRow>('users').where({ email: providerEmail }).first();
    }

    const isNewUser = !userRow;

    if (!userRow) {
      // Create a new account from the OAuth profile.
      // No password — this account is passwordless (OAuth only).
      const [newRow] = await this.db<UserRow>('users')
        .insert({
          email: providerEmail ?? `oauth-${providerName}-${providerUserId}@vortex.local`,
          password_hash: await hashPassword(`oauth:${providerName}:${providerUserId}:${Date.now()}`),
          role: 'user',
          metadata: {
            provider: providerName,
            name,
            ...(profile.picture ? { picture: profile.picture } : {}),
          },
        })
        .returning('*');
      userRow = newRow;
    }

    if (!userRow) throw new ApiError(500, 'internal', 'Could not create or find user');

    // 4. Link the provider account (upsert).
    await this.db('vortex_oauth_accounts')
      .insert({
        user_id: userRow.id,
        provider: providerName,
        provider_user_id: providerUserId,
        provider_email: providerEmail,
        profile,
      })
      .onConflict(['provider', 'provider_user_id'])
      .ignore();

    // 5. Sign a Vortex session.
    const token = signToken(
      {
        userId: userRow.id,
        email: userRow.email,
        role: userRow.role,
        meta: userRow.metadata ?? {},
      },
      this.tokenConfig,
    );

    return {
      session: {
        user: {
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          metadata: userRow.metadata ?? {},
          createdAt: userRow.created_at.toISOString(),
        },
        token,
        expiresIn: 3600,
      },
      isNewUser,
      linkedProvider: providerName,
    };
  }

  /** List linked OAuth accounts for a user. */
  async listAccounts(userId: string): Promise<OAuthAccount[]> {
    const rows = await this.db<AccountRow>('vortex_oauth_accounts')
      .where({ user_id: userId })
      .orderBy('linked_at');
    return rows.map(toAccount);
  }

  /** Unlink a provider account from a user. */
  async unlinkAccount(userId: string, providerName: string, actorId: string): Promise<void> {
    if (userId !== actorId && reqAuthNotAdmin(actorId)) {
      throw ApiError.forbidden('You can only unlink your own accounts');
    }
    const deleted = await this.db('vortex_oauth_accounts')
      .where({ user_id: userId, provider: providerName })
      .del();
    if (!deleted) throw ApiError.notFound('Account not linked');
  }

  /** List providers that are enabled and ready for login. */
  async listEnabledProviders(): Promise<OAuthProvider[]> {
    const rows = await this.db<ProviderRow>('vortex_oauth_providers')
      .where({ enabled: true })
      .orderBy('name');
    return rows.map(toProvider);
  }

  /** Get the redirect URI for a given provider. */
  redirectUri(providerName: string): string {
    const base = this.opts.publicAppUrl.replace(/\/+$/, '');
    return `${base}/v1/auth/oauth/${providerName}/callback`;
  }
}

/** Helper for the admin check in unlink. */
function reqAuthNotAdmin(actorId: string): boolean {
  return false; // Placeholder — actual admin check happens in routes via requireAuth
}

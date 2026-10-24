import type { HttpClient } from './http.js';
import type {
  AuthSession, AuthUser, SignupInput, LoginInput, MagicLinkResult,
  OAuthProvider, OAuthAccount, OAuthLoginResult,
} from './types.js';

/**
 * Vortex Auth — signup, login, magic links, password reset, session.
 *
 * The SDK manages the token: after signup/login/magic-verify, the token
 * is stored in the HTTP client and attached to all subsequent requests.
 * Call `signOut()` to clear it.
 */
export class Auth {
  constructor(private readonly http: HttpClient) {}

  /** Sign up a new account. Returns a session with a JWT. */
  async signup(input: SignupInput): Promise<AuthSession> {
    const session = await this.http.request<AuthSession>('/v1/auth/signup', {
      method: 'POST',
      body: input,
    });
    this.http.setToken(session.token);
    return session;
  }

  /** Log in with email + password. */
  async login(input: LoginInput): Promise<AuthSession> {
    const session = await this.http.request<AuthSession>('/v1/auth/login', {
      method: 'POST',
      body: input,
    });
    this.http.setToken(session.token);
    return session;
  }

  /** Get the current user from the token. */
  async me(): Promise<AuthUser> {
    const { user } = await this.http.request<{ user: AuthUser }>('/v1/auth/me');
    return user;
  }

  /** Request a magic sign-in link. */
  async requestMagicLink(email: string): Promise<MagicLinkResult> {
    return this.http.request<MagicLinkResult>('/v1/auth/magic-link', {
      method: 'POST',
      body: { email },
    });
  }

  /** Verify a magic link token and log in. */
  async verifyMagicLink(token: string): Promise<AuthSession> {
    const session = await this.http.request<AuthSession>('/v1/auth/magic-link/verify', {
      method: 'POST',
      body: { token },
    });
    this.http.setToken(session.token);
    return session;
  }

  /** Request a password reset link. */
  async requestPasswordReset(email: string): Promise<MagicLinkResult> {
    return this.http.request<MagicLinkResult>('/v1/auth/password-reset', {
      method: 'POST',
      body: { email },
    });
  }

  /** Confirm a password reset and log in. */
  async confirmPasswordReset(token: string, password: string): Promise<AuthSession> {
    const session = await this.http.request<AuthSession>('/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: { token, password },
    });
    this.http.setToken(session.token);
    return session;
  }

  /** Sign out — clears the token from the HTTP client. */
  // ── OAuth ──────────────────────────────────────────────────────────────

  /** List enabled OAuth providers (for login UI). */
  async listOAuthProviders(): Promise<Array<{ name: string; displayName: string; scopes: string }>> {
    const { providers } = await this.http.request<{
      providers: Array<{ name: string; displayName: string; scopes: string }>;
    }>('/v1/auth/oauth/providers');
    return providers;
  }

  /** Start OAuth login — returns the provider's authorize URL. */
  async getOAuthAuthorizeUrl(provider: string, redirectUri?: string): Promise<string> {
    const url = await this.http.request<string>(`/v1/auth/oauth/${provider}/start`, {
      method: 'GET',
    }).catch(() => null);
    // The server redirects, so we need to follow it.
    const finalUrl = await this.followRedirect(`/v1/auth/oauth/${provider}/start`);
    return finalUrl ?? url ?? '';
  }

  /**
   * Handle an OAuth callback — exchanges the code and returns a session.
   * Call this after the provider redirects to your callback URL.
   */
  async handleOAuthCallback(provider: string, code: string, redirectUri?: string): Promise<OAuthLoginResult> {
    const query = redirectUri ? `?redirect=${encodeURIComponent(redirectUri)}` : '';
    return this.http.request<OAuthLoginResult>(
      `/v1/auth/oauth/${provider}/callback?code=${encodeURIComponent(code)}${query}`,
    );
  }

  /** List your linked OAuth accounts. */
  async listOAuthAccounts(): Promise<OAuthAccount[]> {
    const { accounts } = await this.http.request<{ accounts: OAuthAccount[] }>(
      '/v1/auth/oauth/accounts',
    );
    return accounts;
  }

  /** Unlink an OAuth provider from your account. */
  async unlinkOAuthAccount(provider: string): Promise<void> {
    await this.http.request(`/v1/auth/oauth/accounts/${provider}`, { method: 'DELETE' });
  }

  // ── Admin OAuth management ─────────────────────────────────────────────

  /** List all configured OAuth providers (admin). */
  async listOAuthProvidersAdmin(): Promise<OAuthProvider[]> {
    const { providers } = await this.http.request<{ providers: OAuthProvider[] }>(
      '/v1/auth/oauth/admin/providers',
    );
    return providers;
  }

  /** Create or update an OAuth provider (admin). */
  async upsertOAuthProvider(input: {
    name: 'google' | 'github' | 'gitlab' | 'discord' | 'apple' | 'microsoft';
    clientId: string;
    clientSecret: string;
    scopes?: string;
    extra?: Record<string, unknown>;
    enabled?: boolean;
    displayName?: string;
  }): Promise<OAuthProvider> {
    const { provider } = await this.http.request<{ provider: OAuthProvider }>(
      '/v1/auth/oauth/admin/providers',
      { method: 'POST', body: input },
    );
    return provider;
  }

  /** Remove an OAuth provider (admin). */
  async deleteOAuthProvider(name: string): Promise<void> {
    await this.http.request(`/v1/auth/oauth/admin/providers/${name}`, { method: 'DELETE' });
  }

  /**
   * Follow a redirect and return the final URL.
   * Used by getOAuthAuthorizeUrl since the server sends a 302.
   */
  private async followRedirect(path: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.http.baseUrl}${path}`, { redirect: 'manual' });
      const location = res.headers.get('location');
      return location ?? null;
    } catch {
      return null;
    }
  }

  signOut(): void {
    this.http.setToken(null);
  }

  // ── Admin operations ──────────────────────────────────────────────────

  /** List all users (admin only). */
  async listUsers(): Promise<AuthUser[]> {
    const { users } = await this.http.request<{ users: AuthUser[] }>('/v1/auth/users');
    return users;
  }

  /** Update a user's metadata or role (admin only). */
  async updateUser(
    userId: string,
    patch: { metadata?: Record<string, unknown>; role?: string },
  ): Promise<AuthUser> {
    const { user } = await this.http.request<{ user: AuthUser }>(
      `/v1/auth/users/${userId}`,
      { method: 'PATCH', body: patch },
    );
    return user;
  }

  /** Delete a user (admin only). */
  async deleteUser(userId: string): Promise<void> {
    await this.http.request(`/v1/auth/users/${userId}`, { method: 'DELETE' });
  }
}

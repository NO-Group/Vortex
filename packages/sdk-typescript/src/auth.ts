import type { HttpClient } from './http.js';
import type {
  AuthSession, AuthUser, SignupInput, LoginInput, MagicLinkResult,
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

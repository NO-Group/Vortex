import { HttpClient } from './http.js';

export interface AuthSession {
  token: string;
  user: { id: string; email: string; role: string; metadata: Record<string, unknown> };
  expiresIn: number;
}

export interface SignupInput {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class Auth {
  constructor(private readonly http: HttpClient) {}

  async signup(input: SignupInput): Promise<AuthSession> {
    return this.http.request<AuthSession>('/v1/auth/signup', { method: 'POST', body: input });
  }

  async login(input: LoginInput): Promise<AuthSession> {
    return this.http.request<AuthSession>('/v1/auth/login', { method: 'POST', body: input });
  }

  async requestMagicLink(email: string): Promise<{ ok: boolean; delivery: string }> {
    return this.http.request('/v1/auth/magic-link', { method: 'POST', body: { email } });
  }

  async verifyMagicLink(token: string): Promise<AuthSession> {
    return this.http.request<AuthSession>('/v1/auth/magic-link/verify', { method: 'POST', body: { token } });
  }

  async requestPasswordReset(email: string): Promise<{ ok: boolean }> {
    return this.http.request('/v1/auth/password-reset', { method: 'POST', body: { email } });
  }

  async confirmPasswordReset(token: string, password: string): Promise<AuthSession> {
    return this.http.request<AuthSession>('/v1/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
  }

  async me(): Promise<{ user: { id: string; email: string; role: string; metadata: Record<string, unknown> } }> {
    return this.http.request('/v1/auth/me');
  }

  async listOAuthProviders(): Promise<Array<{ name: string; displayName: string }>> {
    return this.http.request('/v1/auth/oauth/providers');
  }

  async listOAuthAccounts(): Promise<unknown[]> {
    return this.http.request('/v1/auth/oauth/accounts');
  }

  async unlinkOAuthAccount(provider: string): Promise<{ ok: boolean }> {
    return this.http.request('/v1/auth/oauth/accounts/' + provider, { method: 'DELETE' });
  }

  async registerDevice(input: { token: string; platform: string; pushService?: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean }> {
    return this.http.request('/v1/notifications/devices', { method: 'POST', body: input });
  }

  async sendNotification(input: { title: string; body: string; data?: Record<string, unknown> }): Promise<{ ok: boolean }> {
    return this.http.request('/v1/notifications', { method: 'POST', body: input });
  }
}

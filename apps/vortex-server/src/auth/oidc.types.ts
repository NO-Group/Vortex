/**
 * OIDC / SSO Identity Server types.
 *
 * Vortex acts as an OAuth 2.0 / OpenID Connect provider, allowing
 * external applications to authenticate users via "Sign in with
 * N.O Group".
 */

// ── OAuth Client ──────────────────────────────────────────────────────────

export interface OAuthClient {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
  logoUrl: string | null;
  websiteUrl: string | null;
  enabled: boolean;
  appId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthClientCreateInput {
  name: string;
  description?: string;
  redirectUris: string[];
  scopes?: string[];
  grantTypes?: string[];
  logoUrl?: string;
  websiteUrl?: string;
}

// ── Authorization Code ────────────────────────────────────────────────────

export interface AuthCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  nonce: string | null;
  expiresAt: string;
  usedAt: string | null;
}

// ── OIDC Key ─────────────────────────────────────────────────────────────

export interface OidcKey {
  kid: string;
  privateKey: string;
  publicKey: string;
  alg: string;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
}

// ── Tokens ───────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  auth_time: number;
  nonce: string | null;
  email: string;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
  role: string;
}

// ── Scopes ───────────────────────────────────────────────────────────────

export const DEFAULT_SCOPES = ['openid', 'profile', 'email'] as const;

export function parseScopes(scopeString: string): string[] {
  return scopeString.split(' ').filter(Boolean);
}

export function scopesToString(scopes: string[]): string {
  return scopes.join(' ');
}

// ── JWKS ────────────────────────────────────────────────────────────────

export interface Jwk {
  kid: string;
  kty: 'RSA';
  use: 'sig';
  alg: string;
  n: string; // modulus (base64url)
  e: string; // exponent (base64url)
}

export interface JwksResponse {
  keys: Jwk[];
}

// ── Discovery ───────────────────────────────────────────────────────────

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  scopes_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
}

/**
 * OAuth provider types and configuration.
 */

/** Built-in OAuth provider definitions with default URLs. */
export interface OAuthProviderDef {
  name: string;
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string;
}

/** Providers Vortex knows how to configure by default. */
export const OAUTH_PROVIDERS: Record<string, OAuthProviderDef> = {
  google: {
    name: 'google',
    displayName: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: 'openid profile email',
  },
  github: {
    name: 'github',
    displayName: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    scopes: 'read:user user:email',
  },
  gitlab: {
    name: 'gitlab',
    displayName: 'GitLab',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    userinfoUrl: 'https://gitlab.com/api/v4/user',
    scopes: 'read_user',
  },
  discord: {
    name: 'discord',
    displayName: 'Discord',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userinfoUrl: 'https://discord.com/api/users/@me',
    scopes: 'identify email',
  },
  apple: {
    name: 'apple',
    displayName: 'Apple',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userinfoUrl: 'https://appleid.apple.com/auth/userinfo',
    scopes: 'name email',
  },
  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: 'openid profile email User.Read',
  },
  twitter: {
    name: 'twitter',
    displayName: 'Twitter / X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userinfoUrl: 'https://api.twitter.com/2/users/me',
    scopes: 'users.read tweet.read',
  },
  facebook: {
    name: 'facebook',
    displayName: 'Facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userinfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: 'public_profile,email',
  },
  oidc: {
    name: 'oidc',
    displayName: 'Generic OIDC',
    authUrl: '', // Must be provided when configuring the provider
    tokenUrl: '',
    userinfoUrl: '',
    scopes: 'openid profile email',
  },
};

/** OAuth provider as stored in the database. */
export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string;
  extra: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Linked OAuth account. */
export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail: string | null;
  profile: Record<string, unknown> | null;
  linkedAt: string;
}

/** Result of an OAuth login/link attempt. */
export interface OAuthResult {
  session: { user: { id: string; email: string; role: string; metadata: Record<string, unknown>; createdAt: string }; token: string; expiresIn: number };
  isNewUser: boolean;
  linkedProvider: string;
}

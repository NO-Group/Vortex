import { describe, expect, it } from 'vitest';
import { OAUTH_PROVIDERS, type OAuthProviderDef } from '../src/auth/oauth.types.js';

describe('OAuth provider definitions', () => {
  it('defines all six built-in providers', () => {
    expect(Object.keys(OAUTH_PROVIDERS)).toEqual(
      expect.arrayContaining(['google', 'github', 'gitlab', 'discord', 'apple', 'microsoft']),
    );
  });

  it('each provider has required URLs and scopes', () => {
    for (const [name, def] of Object.entries(OAUTH_PROVIDERS)) {
      expect(def.name, `${name} name`).toBe(name);
      expect(def.displayName, `${name} displayName`).toBeTruthy();
      expect(def.authUrl, `${name} authUrl`).toMatch(/^https?:\/\//);
      expect(def.tokenUrl, `${name} tokenUrl`).toMatch(/^https?:\/\//);
      expect(def.userinfoUrl, `${name} userinfoUrl`).toMatch(/^https?:\/\//);
      expect(def.scopes, `${name} scopes`).toBeTruthy();
    }
  });

  it('Google uses OAuth 2.0 endpoints', () => {
    const google = OAUTH_PROVIDERS.google;
    expect(google.authUrl).toContain('accounts.google.com');
    expect(google.tokenUrl).toContain('oauth2.googleapis.com');
    expect(google.userinfoUrl).toContain('googleapis.com');
  });

  it('GitHub uses GitHub OAuth endpoints', () => {
    const github = OAUTH_PROVIDERS.github;
    expect(github.authUrl).toContain('github.com/login/oauth/authorize');
    expect(github.tokenUrl).toContain('github.com/login/oauth/access_token');
    expect(github.userinfoUrl).toContain('api.github.com/user');
  });

  it('Apple uses Sign in with Apple endpoints', () => {
    const apple = OAUTH_PROVIDERS.apple;
    expect(apple.authUrl).toContain('appleid.apple.com/auth/authorize');
    expect(apple.tokenUrl).toContain('appleid.apple.com/auth/token');
    expect(apple.scopes).toContain('name');
    expect(apple.scopes).toContain('email');
  });

  it('Discord uses Discord OAuth2 endpoints', () => {
    const discord = OAUTH_PROVIDERS.discord;
    expect(discord.authUrl).toContain('discord.com/api/oauth2/authorize');
    expect(discord.scopes).toContain('identify');
    expect(discord.scopes).toContain('email');
  });

  it('Microsoft uses Azure AD endpoints', () => {
    const microsoft = OAUTH_PROVIDERS.microsoft;
    expect(microsoft.authUrl).toContain('login.microsoftonline.com');
    expect(microsoft.scopes).toContain('openid');
    expect(microsoft.scopes).toContain('email');
  });

  it('GitLab uses GitLab OAuth endpoints', () => {
    const gitlab = OAUTH_PROVIDERS.gitlab;
    expect(gitlab.authUrl).toContain('gitlab.com/oauth/authorize');
    expect(gitlab.scopes).toContain('read_user');
  });
});

describe('OAuth provider def shape', () => {
  it('all defs have the same shape', () => {
    const defs = Object.values(OAUTH_PROVIDERS);
    for (const def of defs) {
      const keys = Object.keys(def).sort();
      expect(keys).toEqual(['authUrl', 'displayName', 'name', 'scopes', 'tokenUrl', 'userinfoUrl']);
    }
  });

  it('no provider has empty URLs', () => {
    for (const [name, def] of Object.entries(OAUTH_PROVIDERS)) {
      expect(def.authUrl.length, `${name} authUrl length`).toBeGreaterThan(10);
      expect(def.tokenUrl.length, `${name} tokenUrl length`).toBeGreaterThan(10);
      expect(def.userinfoUrl.length, `${name} userinfoUrl length`).toBeGreaterThan(10);
    }
  });
});

describe('OAuth provider types', () => {
  it('OAuthProviderDef interface is compatible with all providers', () => {
    // Type-level check — if this compiles, the interface matches.
    const def: OAuthProviderDef = OAUTH_PROVIDERS.google;
    expect(def.name).toBe('google');
  });
});

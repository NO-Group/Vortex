import { describe, expect, it } from 'vitest';
import {
  contentTypeFor,
  resolveAppPath,
  validateAppName,
  RESERVED_APP_NAMES,
} from '../src/apps/apps.types.js';
import { bearerFrom } from '../src/middleware/auth.js';

describe('validateAppName', () => {
  it('accepts URL slugs', () => {
    expect(validateAppName('my-app')).toBe('my-app');
    expect(validateAppName('blog')).toBe('blog');
    expect(validateAppName('App-01')).toBe('app-01'); // lowercased
  });

  it('rejects invalid names', () => {
    expect(() => validateAppName('Bad Name')).toThrow();
    expect(() => validateAppName('-lead')).toThrow();
    expect(() => validateAppName('trail-')).toThrow();
    expect(() => validateAppName('')).toThrow();
    expect(() => validateAppName('a'.repeat(31))).toThrow();
    expect(() => validateAppName('../etc')).toThrow();
  });

  it('rejects reserved engine names', () => {
    for (const reserved of ['v1', 'apps', 'healthz', 'auth']) {
      expect(RESERVED_APP_NAMES.has(reserved)).toBe(true);
      expect(() => validateAppName(reserved)).toThrow(/reserved/);
    }
  });
});

describe('resolveAppPath', () => {
  it('normalizes plain paths', () => {
    expect(resolveAppPath('')).toBe('index.html');
    expect(resolveAppPath('/')).toBe('index.html');
    expect(resolveAppPath('/css/app.css')).toBe('css/app.css');
    expect(resolveAppPath('index.html?cache=1')).toBe('index.html');
  });

  it('blocks traversal and null bytes', () => {
    expect(() => resolveAppPath('../secret')).toThrow();
    expect(() => resolveAppPath('a/../../b')).toThrow();
    expect(() => resolveAppPath('a\0b')).toThrow();
    expect(() => resolveAppPath('/..')).toThrow();
  });
});

describe('contentTypeFor', () => {
  it('maps common web extensions', () => {
    expect(contentTypeFor('index.html')).toContain('text/html');
    expect(contentTypeFor('app.js')).toContain('javascript');
    expect(contentTypeFor('style.css')).toContain('text/css');
    expect(contentTypeFor('icon.svg')).toBe('image/svg+xml');
    expect(contentTypeFor('blob.bin')).toBe('application/octet-stream');
  });
});

describe('bearerFrom', () => {
  const fakeReq = (headers: Record<string, string>) =>
    ({
      header: (name: string) => headers[name.toLowerCase()],
    }) as never;

  it('reads Authorization: Bearer', () => {
    expect(bearerFrom(fakeReq({ authorization: 'Bearer abc.def' }))).toBe('abc.def');
  });

  it('falls back to x-vortex-token when Authorization is missing', () => {
    expect(bearerFrom(fakeReq({ 'x-vortex-token': 'abc.def' }))).toBe('abc.def');
  });

  it('prefers Authorization when both are present', () => {
    const req = fakeReq({ authorization: 'Bearer primary', 'x-vortex-token': 'fallback' });
    expect(bearerFrom(req)).toBe('primary');
  });

  it('returns null with neither', () => {
    expect(bearerFrom(fakeReq({}))).toBeNull();
  });
});

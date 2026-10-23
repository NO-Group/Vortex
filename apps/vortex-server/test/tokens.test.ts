import { describe, expect, it } from 'vitest';
import { signToken, verifyToken, type TokenConfig } from '../src/auth/tokens.js';
import { ApiError } from '../src/errors.js';

const config: TokenConfig = {
  secret: 'test-secret-key-for-vortex',
  expiresIn: '1h',
  issuer: 'vortex',
};

describe('tokens', () => {
  it('signs and verifies round-trip claims', () => {
    const token = signToken({ userId: 'user-123', email: 'a@b.co', role: 'user' }, config);
    const claims = verifyToken(token, config);
    expect(claims.sub).toBe('user-123');
    expect(claims.email).toBe('a@b.co');
    expect(claims.role).toBe('user');
    expect(claims.iss).toBe('vortex');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ userId: 'user-123', email: 'a@b.co', role: 'admin' }, config);
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(() => verifyToken(tampered, config)).toThrow(ApiError);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ userId: 'u', email: 'e', role: 'user' }, config);
    expect(() => verifyToken(token, { ...config, secret: 'other-secret' })).toThrow(
      /Invalid or expired token/,
    );
  });

  it('rejects garbage input', () => {
    expect(() => verifyToken('not-a-jwt', config)).toThrow(ApiError);
  });
});

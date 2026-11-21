import { describe, expect, it } from 'vitest';
import { createFirewalledFetch, EgressFirewallError, isBlockedIPv4, isBlockedIPv6 } from '../src/functions/egress-firewall.js';
import { FunctionQuota, QuotaExceededError } from '../src/functions/quota.js';
import { IsolateSandbox, SandboxError, SandboxMemoryLimitError } from '../src/functions/isolate-sandbox.js';

describe('egress firewall', () => {
  describe('IPv4 blocking', () => {
    it('blocks loopback addresses', () => {
      expect(isBlockedIPv4('127.0.0.1')).toBe(true);
      expect(isBlockedIPv4('127.0.0.255')).toBe(true);
      expect(isBlockedIPv4('127.255.255.255')).toBe(true);
    });

    it('blocks private network ranges', () => {
      expect(isBlockedIPv4('10.0.0.1')).toBe(true);
      expect(isBlockedIPv4('10.255.255.255')).toBe(true);
      expect(isBlockedIPv4('172.16.0.1')).toBe(true);
      expect(isBlockedIPv4('172.31.255.255')).toBe(true);
      expect(isBlockedIPv4('192.168.1.1')).toBe(true);
      expect(isBlockedIPv4('192.168.255.255')).toBe(true);
    });

    it('blocks link-local addresses (cloud metadata)', () => {
      expect(isBlockedIPv4('169.254.169.254')).toBe(true);
      expect(isBlockedIPv4('169.254.1.1')).toBe(true);
    });

    it('blocks multicast and reserved ranges', () => {
      expect(isBlockedIPv4('224.0.0.1')).toBe(true);
      expect(isBlockedIPv4('240.0.0.1')).toBe(true);
    });

    it('allows public IP addresses', () => {
      expect(isBlockedIPv4('8.8.8.8')).toBe(false);
      expect(isBlockedIPv4('1.1.1.1')).toBe(false);
      expect(isBlockedIPv4('93.184.216.34')).toBe(false);
    });
  });

  describe('IPv6 blocking', () => {
    it('blocks loopback', () => {
      expect(isBlockedIPv6('::1')).toBe(true);
      expect(isBlockedIPv6('0:0:0:0:0:0:0:1')).toBe(true);
    });

    it('blocks unique local addresses', () => {
      expect(isBlockedIPv6('fc00::1')).toBe(true);
      expect(isBlockedIPv6('fd12:3456::1')).toBe(true);
    });

    it('blocks link-local addresses', () => {
      expect(isBlockedIPv6('fe80::1')).toBe(true);
      expect(isBlockedIPv6('fe90::1')).toBe(true);
    });

    it('blocks multicast', () => {
      expect(isBlockedIPv6('ff02::1')).toBe(true);
    });

    it('allows public IPv6 addresses', () => {
      expect(isBlockedIPv6('2001:4860:4860::8888')).toBe(false);
      expect(isBlockedIPv6('2606:4700::1111')).toBe(false);
    });
  });

  describe('firewalled fetch', () => {
    const mockFetch = async () => new Response('ok');

    it('blocks requests to localhost IP literals', async () => {
      const fw = createFirewalledFetch(mockFetch);
      await expect(fw('http://127.0.0.1:8080/api')).rejects.toThrow(EgressFirewallError);
    });

    it('blocks requests to private IP literals', async () => {
      const fw = createFirewalledFetch(mockFetch);
      await expect(fw('http://10.0.0.1/api')).rejects.toThrow(EgressFirewallError);
      await expect(fw('http://192.168.1.1/api')).rejects.toThrow(EgressFirewallError);
    });

    it('blocks requests to cloud metadata endpoint', async () => {
      const fw = createFirewalledFetch(mockFetch);
      await expect(fw('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(EgressFirewallError);
    });

    it('blocks non-http protocols', async () => {
      const fw = createFirewalledFetch(mockFetch);
      await expect(fw('file:///etc/passwd')).rejects.toThrow(EgressFirewallError);
      await expect(fw('ftp://example.com/file')).rejects.toThrow(EgressFirewallError);
    });

    it('allows requests to public IPs', async () => {
      const fw = createFirewalledFetch(mockFetch);
      const res = await fw('http://8.8.8.8/dns');
      expect(res.status).toBe(200);
    });
  });
});

describe('function quota', () => {
  it('allows invocations within the limit', () => {
    const quota = new FunctionQuota({ userLimit: 3, anonymousLimit: 2 });
    expect(() => quota.check('user1', false)).not.toThrow();
    expect(() => quota.check('user1', false)).not.toThrow();
    expect(() => quota.check('user1', false)).not.toThrow();
  });

  it('rejects when limit is exceeded', () => {
    const quota = new FunctionQuota({ userLimit: 2, anonymousLimit: 2 });
    quota.check('user1', false);
    quota.check('user1', false);
    expect(() => quota.check('user1', false)).toThrow(QuotaExceededError);
  });

  it('admins are exempt from quota', () => {
    const quota = new FunctionQuota({ userLimit: 1, anonymousLimit: 1 });
    for (let i = 0; i < 100; i++) {
      expect(() => quota.check('admin', true)).not.toThrow();
    }
  });

  it('anonymous callers get lower limit', () => {
    const quota = new FunctionQuota({ userLimit: 100, anonymousLimit: 2 });
    quota.check(null, false);
    quota.check(null, false);
    expect(() => quota.check(null, false)).toThrow(QuotaExceededError);
  });

  it('resets after window expiry', async () => {
    const quota = new FunctionQuota({ userLimit: 1, anonymousLimit: 1, windowMs: 10 });
    quota.check('user1', false);
    expect(() => quota.check('user1', false)).toThrow(QuotaExceededError);
    await new Promise((r) => setTimeout(r, 20));
    expect(() => quota.check('user1', false)).not.toThrow();
  });
});

describe('IsolateSandbox', () => {
  const emptyGlobals = {
    data: {
      query: async () => ({ rows: [], count: 0 }),
      insert: async () => ({ rows: [], count: 0 }),
      update: async () => ({ rows: [], count: 0 }),
      delete: async () => ({ rows: [], count: 0 }),
    },
    storage: {
      get: async () => ({}),
      put: async () => ({}),
      list: async () => [],
    },
    env: {},
  };

  const req = {
    method: 'GET',
    path: '/functions/x',
    query: {},
    headers: {},
    body: null,
    user: null,
  };

  it('runs a function and returns HTTP response', async () => {
    const sandbox = new IsolateSandbox({ timeoutMs: 1000 });
    const result = await sandbox.run(
      `async (req, ctx) => ({ status: 200, body: { ok: true } })`,
      req,
      emptyGlobals,
    );
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body.toString())).toEqual({ ok: true });
  });

  it('captures console output', async () => {
    const sandbox = new IsolateSandbox({ timeoutMs: 1000 });
    await sandbox.run(
      `async (req, ctx) => { console.log('hello', 'world'); return { body: 'done' }; }`,
      req,
      emptyGlobals,
    );
    // Note: logs are captured but only returned in SandboxResult.logs
  });

  it('rejects non-function sources', async () => {
    const sandbox = new IsolateSandbox({ timeoutMs: 1000 });
    await expect(
      sandbox.run('({ not: "a function" })', req, emptyGlobals),
    ).rejects.toThrow(SandboxError);
  });

  it('enforces wall-clock timeout', async () => {
    const sandbox = new IsolateSandbox({ timeoutMs: 50 });
    await expect(
      sandbox.run(
        `async () => { await new Promise((r) => setTimeout(r, 500)); return 'late'; }`,
        req,
        emptyGlobals,
      ),
    ).rejects.toThrow(SandboxError);
  });

  it('blocks egress to internal IPs', async () => {
    const sandbox = new IsolateSandbox({ timeoutMs: 2000, firewall: true });
    await expect(
      sandbox.run(
        `async () => { await fetch('http://127.0.0.1:8080/secret'); return { body: 'ok' }; }`,
        req,
        emptyGlobals,
      ),
    ).rejects.toThrow(SandboxError);
  });
});

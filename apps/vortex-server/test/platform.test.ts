import { describe, expect, it } from 'vitest';
import { assertSingleStatement, prepareBindings } from '../src/sql/sql.routes.js';
import { bucketOfKey, validateBucketName, RESERVED_BUCKETS } from '../src/storage/buckets.service.js';
import { validateFunctionName, RESERVED_FUNCTION_NAMES } from '../src/functions/functions.types.js';
import {
  compileFunction,
  runFunction,
  toHttpResponse,
  FunctionCompileError,
  FunctionTimeoutError,
  type FnSandboxGlobals,
} from '../src/functions/runtime.js';
import { hashToken } from '../src/auth/one-time-tokens.js';
import { authLink, magicLinkEmail, passwordResetEmail } from '../src/mailer/mailer.js';
import { applyFilters, applyOrGroups } from '../src/db/query.service.js';
import { RealtimeHub, isValidChannel } from '../src/realtime/hub.js';
import type { WebSocket } from 'ws';

describe('assertSingleStatement', () => {
  it('accepts single statements', () => {
    expect(assertSingleStatement('select 1')).toBe('select 1');
    expect(assertSingleStatement('select 1;')).toBe('select 1');
    expect(assertSingleStatement('select 1 ;; ')).toBe('select 1');
  });

  it('allows semicolons inside strings and comments', () => {
    expect(assertSingleStatement(`select ';' as a`)).toContain(`';'`);
    expect(assertSingleStatement('select 1 -- ; not a second stmt')).toContain('--');
    expect(assertSingleStatement('select 1 /* ; */')).toContain('/*');
  });

  it('rejects multi-statement scripts', () => {
    expect(() => assertSingleStatement('select 1; drop table users')).toThrow(/single SQL/i);
    expect(() => assertSingleStatement('select 1; select 2')).toThrow(/single SQL/i);
  });
});

describe('prepareBindings', () => {
  it('passes ? style through untouched', () => {
    expect(prepareBindings('select ?', [1])).toEqual({
      prepared: 'select ?',
      bindings: [1],
    });
  });

  it('rewrites $n placeholders in appearance order', () => {
    expect(prepareBindings('select $2::text as b, $1::int as a', ['x', 7])).toEqual({
      prepared: 'select ?::text as b, ?::int as a',
      bindings: [7, 'x'],
    });
  });

  it('rejects missing placeholders', () => {
    expect(() => prepareBindings('select $1, $2', ['only-one'])).toThrow(/\$2/);
  });
});

describe('buckets', () => {
  it('validates bucket names', () => {
    expect(validateBucketName('uploads')).toBe('uploads');
    expect(validateBucketName('My-Assets')).toBe('my-assets');
    expect(() => validateBucketName('x')).toThrow();
    expect(() => validateBucketName('Bad Name')).toThrow();
    expect(() => validateBucketName('apps')).toThrow();
    for (const reserved of RESERVED_BUCKETS) {
      expect(() => validateBucketName(reserved)).toThrow();
    }
  });

  it('derives the bucket from a key', () => {
    expect(bucketOfKey('uploads/a/b.txt')).toBe('uploads');
    expect(bucketOfKey('uploads')).toBe('uploads');
  });
});

describe('validateFunctionName', () => {
  it('accepts slugs and rejects reserved names', () => {
    expect(validateFunctionName('hello-world')).toBe('hello-world');
    expect(() => validateFunctionName('Bad!')).toThrow();
    expect(() => validateFunctionName('v1')).toThrow();
    for (const reserved of RESERVED_FUNCTION_NAMES) {
      expect(() => validateFunctionName(reserved)).toThrow();
    }
  });
});

describe('function runtime', () => {
  const emptyGlobals: FnSandboxGlobals = {
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
    query: { name: 'vortex' },
    headers: {},
    body: null,
    user: null,
  };

  it('compiles and runs a function expression', async () => {
    const fn = compileFunction(`async (req, ctx) => ({ body: { hello: req.query.name } })`);
    const out = await runFunction(fn, req as never, emptyGlobals, 1000);
    expect(out.status).toBe(200);
    expect(JSON.parse(out.body.toString())).toEqual({ hello: 'vortex' });
  });

  it('maps return shapes to HTTP responses', () => {
    expect(toHttpResponse(undefined).status).toBe(204);
    expect(toHttpResponse('hi').body.toString()).toBe('hi');
    expect(toHttpResponse({ ok: true }).status).toBe(200);
    const http = toHttpResponse({ status: 201, headers: { 'x-a': 'b' }, body: { id: 1 } });
    expect(http.status).toBe(201);
    expect(http.headers['x-a']).toBe('b');
    expect(JSON.parse(http.body.toString())).toEqual({ id: 1 });
  });

  it('rejects non-function sources', () => {
    expect(() => compileFunction('({ not: "a function" })')).toThrow(FunctionCompileError);
    expect(() => compileFunction('throw new Error("boom")')).toThrow(FunctionCompileError);
  });

  it('enforces the wall-clock timeout', async () => {
    const fn = compileFunction(`async () => { await new Promise((r) => setTimeout(r, 500)); return 'late'; }`);
    await expect(runFunction(fn, req as never, emptyGlobals, 50)).rejects.toThrow(
      FunctionTimeoutError,
    );
  });

  it('exposes ctx.data helpers', async () => {
    const fn = compileFunction(
      `async (req, ctx) => ({ body: await ctx.data.query('notes', { limit: 5 }) })`,
    );
    const out = await runFunction(fn, req as never, emptyGlobals, 1000);
    expect(JSON.parse(out.body.toString())).toEqual({ rows: [], count: 0 });
  });
});

describe('one-time token hashing', () => {
  it('hashes deterministically and non-reversibly', () => {
    const h = hashToken('abc');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(h);
    expect(hashToken('abd')).not.toBe(h);
  });
});

describe('mailer templates', () => {
  it('builds console links with the token', () => {
    expect(authLink('https://vortex.example.com/', 'tok123')).toBe(
      'https://vortex.example.com/?magic=tok123',
    );
    expect(authLink('https://x.dev', 'a b')).toContain('magic=a%20b');
  });

  it('renders branded magic + reset emails around the link', () => {
    const url = 'https://vortex.example.com/?magic=abc';
    const magic = magicLinkEmail(url);
    expect(magic.subject).toMatch(/sign-in/i);
    expect(magic.html).toContain(url);
    expect(magic.html).toContain('Vortex');

    const reset = passwordResetEmail(url);
    expect(reset.subject).toMatch(/reset/i);
    expect(reset.html).toContain(url);
  });
});

describe('query ops', () => {
  const stub = () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query: Record<string, unknown> = {};
    const chain = (method: string) => (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
    Object.assign(query, {
      where: chain('where'),
      whereIn: chain('whereIn'),
      whereNull: chain('whereNull'),
      whereRaw: chain('whereRaw'),
      orWhere: chain('orWhere'),
    });
    return { query: query as never, calls };
  };

  it('supports ilike and contains', () => {
    const { query, calls } = stub();
    applyFilters(query, [
      { column: 'title', op: 'ilike', value: '%vortex%' },
      { column: 'meta', op: 'contains', value: { tag: 'x' } },
    ]);
    expect(calls[0]).toEqual({
      method: 'where',
      args: ['title', 'ilike', '%vortex%'],
    });
    expect(calls[1]!.method).toBe('whereRaw');
  });

  it('applies OR groups as an outer where-builder', () => {
    const { query, calls } = stub();
    applyOrGroups(query, [[{ column: 'a', value: 1 }], [{ column: 'b', value: 2 }]]);
    expect(calls[0]!.method).toBe('where');
  });
});

describe('realtime hub — rooms, broadcast, presence', () => {
  const fakeSocket = () => {
    const sent: string[] = [];
    const socket = {
      OPEN: 1,
      readyState: 1,
      send: (data: string) => sent.push(data),
    } as unknown as WebSocket & { sent: string[] };
    (socket as { sent: string[] }).sent = sent;
    return socket;
  };

  it('validates room channels', () => {
    expect(isValidChannel('room:lobby')).toBe(true);
    expect(isValidChannel('room:demo-room_1')).toBe(true);
    expect(isValidChannel('table:notes')).toBe(true);
    expect(isValidChannel('table:*')).toBe(true);
    expect(isValidChannel('room:Bad Room')).toBe(false);
    expect(isValidChannel('other:x')).toBe(false);
  });

  it('relays broadcasts to channel subscribers', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.register(a);
    hub.register(b);
    hub.subscribe(a, 'room:lobby');
    hub.subscribe(b, 'room:lobby');

    const delivered = hub.publishBroadcast('room:lobby', 'chat', { text: 'hi' }, 'client-a');
    expect(delivered).toBe(2);
    const framesB = (b as unknown as { sent: string[] }).sent.map((s) => JSON.parse(s));
    expect(framesB.some((f) => f.type === 'vortex:broadcast' && f.event === 'chat')).toBe(true);
  });

  it('tracks presence with sync + diff frames', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    const b = fakeSocket();
    const ca = hub.register(a);
    hub.register(b);
    hub.subscribe(a, 'room:lobby');
    hub.subscribe(b, 'room:lobby');

    const peers = hub.track(a, 'room:lobby', { name: 'A' });
    expect(peers).toHaveLength(1);

    hub.track(b, 'room:lobby', { name: 'B' });
    expect(hub.peers('room:lobby')).toHaveLength(2);

    hub.untrack(a, 'room:lobby');
    expect(hub.peers('room:lobby')).toHaveLength(1);

    // unregister sweeps the rest and diffs the room
    hub.unregister(b);
    expect(hub.peers('room:lobby')).toHaveLength(0);

    const framesA = (a as unknown as { sent: string[] }).sent.map((s) => JSON.parse(s));
    expect(framesA.some((f) => f.type === 'vortex:welcome' && f.clientId === ca.clientId)).toBe(true);
    expect(framesA.some((f) => f.type === 'vortex:presence_sync')).toBe(true);
  });

  it('refuses presence/broadcast on channels the socket has not joined', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    hub.register(a);
    expect(hub.track(a, 'room:lobby', {})).toBeNull();
  });
});

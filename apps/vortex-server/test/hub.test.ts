import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { PROTOCOL } from '@vortex/core';
import { RealtimeHub, isValidChannel } from '../src/realtime/hub.js';
import type { TableChange } from '../src/realtime/bus.js';

function fakeSocket() {
  const sent: string[] = [];
  const socket = {
    readyState: 1, // WebSocket.OPEN
    OPEN: 1,
    send: (payload: string) => sent.push(payload),
  } as unknown as WebSocket & { sent: string[] };
  (socket as unknown as { sent: string[] }).sent = sent;
  return socket;
}

const change = (table: string): TableChange => ({
  id: 'evt-1',
  table,
  action: 'INSERT',
  rows: [{ id: 1 }],
  actorId: 'u-1',
  timestamp: new Date().toISOString(),
});

describe('RealtimeHub', () => {
  it('delivers table events to matching subscribers', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.register(a);
    hub.register(b);
    hub.subscribe(a, 'table:notes');
    hub.subscribe(b, 'table:users');

    const delivered = hub.publishTableChange(change('notes'));

    expect(delivered).toBe(1);
    const frame = JSON.parse((a as unknown as { sent: string[] }).sent[0]!);
    expect(frame.type).toBe(PROTOCOL.event);
    expect(frame.table).toBe('notes');
    expect((b as unknown as { sent: string[] }).sent).toHaveLength(0);
  });

  it('fans out to wildcard subscribers too', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.register(a);
    hub.register(b);
    hub.subscribe(a, 'table:*');
    hub.subscribe(b, 'table:notes');

    expect(hub.publishTableChange(change('notes'))).toBe(2);
    expect((a as unknown as { sent: string[] }).sent).toHaveLength(1);
    expect((b as unknown as { sent: string[] }).sent).toHaveLength(1);
  });

  it('rejects malformed channel names', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    hub.register(a);
    expect(hub.subscribe(a, 'notes')).toBe(false);
    expect(hub.subscribe(a, 'table:DROP TABLE')).toBe(false);
    expect(hub.subscribe(a, 'table:good_name_1')).toBe(true);
  });

  it('cleans up subscriptions on unregister', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    hub.register(a);
    hub.subscribe(a, 'table:notes');
    expect(hub.subscriberCount('table:notes')).toBe(1);

    hub.unregister(a);
    expect(hub.subscriberCount('table:notes')).toBe(0);
    expect(hub.connectionCount).toBe(0);
  });

  it('skips sockets that are not open', () => {
    const hub = new RealtimeHub();
    const a = fakeSocket();
    (a as unknown as { readyState: number }).readyState = 3; // CLOSED
    hub.register(a);
    hub.subscribe(a, 'table:notes');
    expect(hub.publishTableChange(change('notes'))).toBe(0);
  });
});

describe('isValidChannel', () => {
  it('accepts table channels', () => {
    expect(isValidChannel('table:users')).toBe(true);
    expect(isValidChannel('table:*')).toBe(true);
  });

  it('rejects junk', () => {
    expect(isValidChannel('users')).toBe(false);
    expect(isValidChannel('table:')).toBe(false);
    expect(isValidChannel('channel:users')).toBe(false);
    expect(isValidChannel('')).toBe(false);
  });
});

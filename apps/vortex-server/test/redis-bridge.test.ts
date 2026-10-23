import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { PROTOCOL } from '@vortex/core';
import { VortexEventBus, type TableChange } from '../src/realtime/bus.js';
import { RealtimeHub } from '../src/realtime/hub.js';
import {
  RedisEventBridge,
  REDIS_EVENTS_CHANNEL,
  type RedisPubSubClient,
} from '../src/realtime/redis-bridge.js';

// ── In-memory Redis pub/sub fake (matches real delivery semantics: every
//    subscriber to a channel receives every message, including its own). ──

class FakeBroker {
  private readonly subs = new Map<string, Set<FakeRedis>>();

  subscribe(channel: string, client: FakeRedis): void {
    let set = this.subs.get(channel);
    if (!set) {
      set = new Set();
      this.subs.set(channel, set);
    }
    set.add(client);
  }

  publish(channel: string, message: string): void {
    for (const client of this.subs.get(channel) ?? []) {
      client.deliver(channel, message);
    }
  }
}

class FakeRedis implements RedisPubSubClient {
  private readonly listeners: Array<(channel: string, message: string) => void> = [];

  constructor(private readonly broker: FakeBroker) {}

  async publish(channel: string, message: string): Promise<number> {
    this.broker.publish(channel, message);
    return 1;
  }

  async subscribe(channel: string): Promise<void> {
    this.broker.subscribe(channel, this);
  }

  on(_event: 'message', listener: (channel: string, message: string) => void): this {
    this.listeners.push(listener);
    return this;
  }

  async quit(): Promise<void> {}

  deliver(channel: string, message: string): void {
    for (const listener of this.listeners) listener(channel, message);
  }
}

function fakeSocket() {
  const sent: string[] = [];
  const socket = {
    readyState: 1,
    OPEN: 1,
    send: (payload: string) => sent.push(payload),
  } as unknown as WebSocket & { sent: string[] };
  (socket as unknown as { sent: string[] }).sent = sent;
  return socket;
}

const change = (id: string): TableChange => ({
  id,
  table: 'notes',
  action: 'INSERT',
  rows: [{ id: 1 }],
  actorId: 'u-1',
  timestamp: new Date().toISOString(),
});

describe('RedisEventBridge', () => {
  it('publishes local changes as envelopes with its node id', async () => {
    const broker = new FakeBroker();
    const bus = new VortexEventBus();
    const hub = new RealtimeHub();
    const pub = new FakeRedis(broker);
    const sub = new FakeRedis(broker);
    const bridge = new RedisEventBridge(bus, hub, pub, sub, 'node-a');
    await bridge.start();

    const captured: string[] = [];
    const watcher = new FakeRedis(broker);
    await watcher.subscribe(REDIS_EVENTS_CHANNEL);
    watcher.on('message', (_ch, msg) => captured.push(msg));

    bus.emitTableChange({ table: 'notes', action: 'INSERT', rows: [{ id: 1 }], actorId: 'u1' });

    expect(captured).toHaveLength(1);
    const envelope = JSON.parse(captured[0]!);
    expect(envelope.nodeId).toBe('node-a');
    expect(envelope.change.table).toBe('notes');
    expect(envelope.change.action).toBe('INSERT');
  });

  it('fans remote changes out to local subscribers', async () => {
    const broker = new FakeBroker();
    const bus = new VortexEventBus();
    const hub = new RealtimeHub();
    const bridge = new RedisEventBridge(bus, hub, new FakeRedis(broker), new FakeRedis(broker), 'node-a');
    await bridge.start();

    const socket = fakeSocket();
    hub.register(socket);
    hub.subscribe(socket, 'table:notes');

    // A peer node publishes a change.
    const peer = new FakeRedis(broker);
    await peer.publish(
      REDIS_EVENTS_CHANNEL,
      JSON.stringify({ nodeId: 'node-b', change: change('evt-remote') }),
    );

    const frames = (socket as unknown as { sent: string[] }).sent
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter((f) => f.type === PROTOCOL.event);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.id).toBe('evt-remote');
  });

  it('suppresses echoes of its own changes (already fanned out locally)', async () => {
    const broker = new FakeBroker();
    const bus = new VortexEventBus();
    const hub = new RealtimeHub();
    const bridge = new RedisEventBridge(bus, hub, new FakeRedis(broker), new FakeRedis(broker), 'node-a');
    await bridge.start();

    const socket = fakeSocket();
    hub.register(socket);
    hub.subscribe(socket, 'table:*');

    // The bridge's own envelope comes back through Redis (real semantics).
    bridge.handleRemote(
      JSON.stringify({ nodeId: 'node-a', change: change('evt-own') }),
    );

    const events = (socket as unknown as { sent: string[] }).sent
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter((f) => f.type === PROTOCOL.event);
    expect(events).toHaveLength(0);
  });

  it('ignores malformed envelopes', async () => {
    const hub = new RealtimeHub();
    const bridge = new RedisEventBridge(
      new VortexEventBus(),
      hub,
      new FakeRedis(new FakeBroker()),
      new FakeRedis(new FakeBroker()),
      'node-a',
    );

    bridge.handleRemote('not json');
    bridge.handleRemote('{"nodeId":42}');
    bridge.handleRemote('{"nodeId":"node-b"}');
    bridge.handleRemote('{"nodeId":"node-b","change":{"id":"x"}}'); // missing table

    expect(hub.connectionCount).toBe(0);
  });

  it('stops delivering after stop()', async () => {
    const broker = new FakeBroker();
    const bus = new VortexEventBus();
    const hub = new RealtimeHub();
    const bridge = new RedisEventBridge(bus, hub, new FakeRedis(broker), new FakeRedis(broker), 'node-a');
    await bridge.start();
    await bridge.stop();

    const socket = fakeSocket();
    hub.register(socket);
    hub.subscribe(socket, 'table:*');

    // Local changes after stop() must not reach Redis...
    const captured: string[] = [];
    const watcher = new FakeRedis(broker);
    await watcher.subscribe(REDIS_EVENTS_CHANNEL);
    watcher.on('message', (_ch, msg) => captured.push(msg));
    bus.emitTableChange({ table: 'notes', action: 'DELETE', rows: [], actorId: null });

    expect(captured).toHaveLength(0);
  });
});

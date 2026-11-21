import type { TableChange, VortexEventBus } from './bus.js';
import type { RealtimeHub } from './hub.js';

/**
 * Minimal pub/sub surface used by the bridge — structurally satisfied by
 * `ioredis`, and by in-memory fakes in unit tests.
 */
export interface RedisPubSubClient {
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
}

/** Redis channel carrying all table-change envelopes between engine nodes. */
export const REDIS_EVENTS_CHANNEL = 'vortex:events';

export interface BridgeEnvelope {
  /** Originating engine node — used for echo suppression. */
  nodeId: string;
  change: TableChange;
}

/**
 * Redis pub/sub bridge for multi-node realtime fan-out.
 *
 * Fan-out strategy (echo-suppressed):
 *   local mutation → hub (direct, in-process — the sub-50ms hot path)
 *                 → Redis publish (for peer nodes)
 *   Redis message → hub, unless the envelope originated from this node.
 *
 * A cluster of Vortex engines sharing one Redis behaves as a single
 * realtime fabric: subscribers on any node see mutations from any node.
 */
export class RedisEventBridge {
  private detachLocal: (() => void) | null = null;
  private started = false;

  constructor(
    private readonly bus: VortexEventBus,
    private readonly hub: RealtimeHub,
    private readonly publisher: RedisPubSubClient,
    private readonly subscriber: RedisPubSubClient,
    readonly nodeId: string,
  ) {}

  /** Subscribe to the events channel and attach the local publish hook. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await this.subscriber.subscribe(REDIS_EVENTS_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== REDIS_EVENTS_CHANNEL) return;
      this.handleRemote(message);
    });

    this.detachLocal = this.bus.onTableChange((change) => {
      void this.publish(change);
    });
  }

  /** Detach and close both Redis connections. */
  async stop(): Promise<void> {
    this.detachLocal?.();
    this.detachLocal = null;
    this.started = false;
    await this.subscriber.quit().catch(() => undefined);
    await this.publisher.quit().catch(() => undefined);
  }

  /** Publish a local change to peer nodes. */
  private async publish(change: TableChange): Promise<void> {
    const envelope: BridgeEnvelope = { nodeId: this.nodeId, change };
    try {
      await this.publisher.publish(REDIS_EVENTS_CHANNEL, JSON.stringify(envelope));
    } catch (err) {
      // Local sockets are unaffected (direct bus→hub path); peers just
      // miss this change until the connection recovers.
      // eslint-disable-next-line no-console
      console.error('[vortex] redis publish failed:', err);
    }
  }

  /**
   * Handle an envelope from the shared bus. Public for unit tests.
   * Echo suppression: messages that originated on this node were already
   * fanned out locally, so they are dropped here.
   */
  handleRemote(raw: string): void {
    let envelope: BridgeEnvelope;
    try {
      envelope = JSON.parse(raw) as BridgeEnvelope;
    } catch {
      return;
    }
    if (!envelope || typeof envelope.nodeId !== 'string') return;
    if (envelope.nodeId === this.nodeId) return;
    const change = envelope.change;
    if (!change || typeof change.table !== 'string') return;

    this.hub.publishTableChange(change);
  }
}

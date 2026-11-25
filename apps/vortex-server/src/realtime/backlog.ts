import type { TableChangeMessage } from '@vortex/core';

/**
 * Durable realtime backlog.
 *
 * Fire-and-forget realtime (Supabase included) drops everything that happens
 * while a client is disconnected — a tunnel blip silently loses your events
 * and there is no way to ask for them back.
 *
 * Vortex keeps a bounded ring buffer per channel with a monotonic sequence
 * number. A reconnecting client re-subscribes with `since: <last seq>` and
 * gets the missed events replayed before live traffic resumes. If it was away
 * longer than the buffer covers, the server says so (`truncated`) instead of
 * pretending the gap never happened.
 */
export interface BufferedEvent {
  seq: number;
  channel: string;
  message: TableChangeMessage;
}

export class EventBacklog {
  private readonly buffers = new Map<string, BufferedEvent[]>();
  private readonly cursors = new Map<string, number>();

  constructor(private readonly maxPerChannel = 500) {}

  /** Record an event, stamping it with the channel's next sequence number. */
  push(channel: string, message: Omit<TableChangeMessage, 'seq'>): BufferedEvent {
    const next = (this.cursors.get(channel) ?? 0) + 1;
    this.cursors.set(channel, next);

    const event: BufferedEvent = { seq: next, channel, message: { ...message, seq: next } };

    let buffer = this.buffers.get(channel);
    if (!buffer) {
      buffer = [];
      this.buffers.set(channel, buffer);
    }
    buffer.push(event);
    if (buffer.length > this.maxPerChannel) {
      buffer.splice(0, buffer.length - this.maxPerChannel);
    }
    return event;
  }

  /** Events after `since` that are still in the buffer. */
  since(channel: string, after: number): BufferedEvent[] {
    const buffer = this.buffers.get(channel);
    if (!buffer?.length) return [];
    const wanted = buffer.filter((e) => e.seq > after);
    // The oldest buffered event tells us whether the requested window is
    // still fully covered, or whether older events were already evicted.
    return wanted;
  }

  /**
   * True when the backlog no longer reaches all the way back to `after`,
   * i.e. events the client missed have already been evicted.
   */
  isTruncated(channel: string, after: number): boolean {
    const buffer = this.buffers.get(channel);
    if (!buffer?.length) return false;
    return buffer[0]!.seq > after + 1;
  }

  /** Latest sequence number issued for a channel. */
  cursor(channel: string): number {
    return this.cursors.get(channel) ?? 0;
  }

  /** Live event with its sequence number attached (no buffering). */
  static stamp(channel: string, message: Omit<TableChangeMessage, 'seq'>, seq: number): TableChangeMessage {
    return { ...message, seq };
  }

  /** Drop a channel's buffer entirely (used by tests / admin resets). */
  clear(channel?: string): void {
    if (channel) {
      this.buffers.delete(channel);
      this.cursors.delete(channel);
      return;
    }
    this.buffers.clear();
    this.cursors.clear();
  }
}

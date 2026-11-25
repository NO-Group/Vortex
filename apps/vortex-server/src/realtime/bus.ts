import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export type TableChangeAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface TableChange {
  id: string;
  table: string;
  action: TableChangeAction;
  rows: Record<string, unknown>[];
  actorId: string | null;
  timestamp: string;
}

export type TableChangeListener = (change: TableChange) => void;

/**
 * In-process event bus decoupling the database layer from the realtime
 * fan-out. For multi-node deployments this is the seam where a Redis
 * pub/sub bridge plugs in without touching query code.
 */
export class VortexEventBus extends EventEmitter {
  /** Publish a database mutation. */
  emitTableChange(input: {
    table: string;
    action: TableChangeAction;
    rows: Record<string, unknown>[];
    actorId: string | null;
  }): TableChange {
    const change: TableChange = {
      id: randomUUID(),
      table: input.table,
      action: input.action,
      rows: input.rows,
      actorId: input.actorId,
      timestamp: new Date().toISOString(),
    };
    this.emit('table-change', change);
    return change;
  }

  /** Subscribe to all database mutations. */
  onTableChange(listener: TableChangeListener): () => void {
    this.on('table-change', listener);
    return () => this.off('table-change', listener);
  }
}

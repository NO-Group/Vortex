import type { Knex } from 'knex';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class BackupsService {
  constructor(private readonly db: Knex, private readonly dbUrl: string) {}

  async create(name: string, type: 'full' | 'incremental' | 'logical' = 'full', triggeredBy?: string) {
    const [id] = await this.db('backups').insert({
      name,
      type,
      status: 'running',
      triggered_by: triggeredBy ?? null,
      trigger_type: 'manual',
      started_at: this.db.fn.now(),
    });
    return { id };
  }

  async list(limit = 50) {
    return this.db('backups').orderBy('created_at', 'desc').limit(limit);
  }

  async get(id: string) {
    return this.db('backups').where({ id }).first();
  }

  async delete(id: string): Promise<number> {
    return this.db('backups').where({ id }).del();
  }

  /** Run a logical backup via pg_dump. */
  async runBackup(id: string): Promise<void> {
    try {
      const backup = await this.get(id);
      if (!backup) return;

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${backup.name}_${ts}.sql`;

      const { stdout } = await execAsync(
        `pg_dump "${this.dbUrl}" -f "${filename}"`,
        { timeout: 600000 },
      );

      const stat = await import('node:fs/promises').then((fs) => fs.stat(filename));
      await this.db('backups').where({ id }).update({
        status: 'completed',
        storage_path: filename,
        size_bytes: stat.size,
        completed_at: this.db.fn.now(),
      });
    } catch (err) {
      await this.db('backups').where({ id }).update({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Restore a backup from a SQL file. */
  async restore(backupId: string): Promise<void> {
    const backup = await this.get(backupId);
    if (!backup || !backup.storage_path) throw new Error('Backup not found or has no file');

    await execAsync(`psql "${this.dbUrl}" -f "${backup.storage_path}"`, { timeout: 600000 });
  }
}

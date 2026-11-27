import type { Knex } from 'knex';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class DataExportService {
  constructor(private readonly db: Knex, private readonly dbUrl: string) {}

  async create(name: string, format: 'json' | 'csv' | 'sql' | 'parquet', tables: string[], projectId?: string) {
    const [id] = await this.db('data_exports').insert({
      name,
      format,
      tables,
      project_id: projectId ?? null,
      status: 'pending',
    });
    return { id };
  }

  async list(limit = 50) {
    return this.db('data_exports').orderBy('created_at', 'desc').limit(limit);
  }

  async get(id: string) {
    return this.db('data_exports').where({ id }).first();
  }

  async delete(id: string): Promise<number> {
    return this.db('data_exports').where({ id }).del();
  }

  /** Execute a data export. */
  async run(id: string): Promise<void> {
    try {
    const exp = await this.get(id);
    if (!exp) return;

    await this.db('data_exports').where({ id }).update({ status: 'running' });

    if (exp.format === 'sql') {
        // Full database dump
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const file = `${exp.name}_${ts}.sql`;
        await execAsync(`pg_dump "${this.dbUrl}" -f "${file}"`, { timeout: 600000 });
        await this.db('data_exports').where({ id }).update({
          status: 'completed',
          file_size_bytes: (await import('node:fs/promises').then((fs) => fs.stat(file))).size,
        });
        return;
      }

      if (exp.format === 'csv') {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const file = `${exp.name}_${ts}.csv`;
        for (const table of exp.tables) {
          await execAsync(`pg_dump "${this.dbUrl}" -t "${table}" --data-only --csv -f "${file}"`);
        }
        await this.db('data_exports').where({ id }).update({
          status: 'completed',
          file_size_bytes: (await import('node:fs/promises').then((fs) => fs.stat(file))).size,
        });
        return;
      }

      // JSON — dump each table
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      for (const table of exp.tables) {
        const rows = await this.db(table).select('*');
        const fs = await import('node:fs/promises');
        await fs.writeFile(`${exp.name}_${ts}_${table}.json`, JSON.stringify(rows, null, 2));
      }

      await this.db('data_exports').where({ id }).update({ status: 'completed' });
    } catch (err) {
      await this.db('data_exports').where({ id }).update({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

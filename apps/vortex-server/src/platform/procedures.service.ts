import type { Knex } from 'knex';

export class ProceduresService {
  constructor(private readonly db: Knex) {}

  async create(name: string, body: string, params?: Array<{ name: string; type: string; mode?: string }>, language = 'sql') {
    const [id] = await this.db('stored_procedures').insert({
      name,
      language,
      body,
      parameters: params ?? null,
      returns: null,
    });
    return { id };
  }

  async list() {
    return this.db('stored_procedures').orderBy('created_at', 'desc');
  }

  async get(name: string) {
    return this.db('stored_procedures').where({ name }).first();
  }

  async delete(name: string): Promise<number> {
    return this.db('stored_procedures').where({ name }).del();
  }

  /** Execute a stored procedure by name. */
  async execute(name: string, args: unknown[] = []) {
    const proc = await this.get(name);
    if (!proc) throw new Error(`Stored procedure '${name}' not found`);
    if (!proc.enabled) throw new Error(`Stored procedure '${name}' is disabled`);

    const argStr = args.map((a) => JSON.stringify(a)).join(', ');
    const callExpr = proc.language === 'plpgsql'
      ? `SELECT * FROM ${name}(${argStr})`
      : `SELECT * FROM ${name}(${argStr})`;

    return this.db.raw(callExpr);
  }
}

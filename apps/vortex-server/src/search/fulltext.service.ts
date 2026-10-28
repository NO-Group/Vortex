import type { Knex } from 'knex';
import { ApiError } from '../errors.js';
import { assertIdentifier } from '../db/query.service.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface FulltextIndex {
  id: string;
  tableName: string;
  name: string;
  columns: string[];
  language: string;
  indexName: string;
  createdAt: string;
}

export interface FulltextSearchResult {
  id: string;
  rank: number;
  row: Record<string, unknown>;
}

interface IndexRow {
  id: string;
  user_id: string;
  table_name: string;
  name: string;
  columns: string[];
  language: string;
  index_name: string;
  created_at: Date;
}

function toIndex(row: IndexRow): FulltextIndex {
  return {
    id: row.id,
    tableName: row.table_name,
    name: row.name,
    columns: Array.isArray(row.columns) ? row.columns : JSON.parse(row.columns),
    language: row.language,
    indexName: row.index_name,
    createdAt: row.created_at.toISOString(),
  };
}

const INDEX_NAME = /^[a-z0-9][a-z0-9-]{1,38}$/;
const SUPPORTED_LANGUAGES = new Set(['english', 'simple', 'german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'russian', 'chinese']);

/** Validate and sanitize a table name. */
function validateTable(name: string): string {
  return assertIdentifier(name, 'Table');
}

/** Validate column names. */
function validateColumns(columns: string[]): string[] {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw ApiError.badRequest('At least one column must be specified');
  }
  if (columns.length > 5) {
    throw ApiError.badRequest('Maximum 5 columns per full-text index');
  }
  return columns.map((c) => assertIdentifier(c, 'Column'));
}

/** Validate the index name. */
function validateIndexName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!INDEX_NAME.test(trimmed)) {
    throw ApiError.badRequest(
      'Index name must be 2-39 chars of lowercase letters, digits, and dashes',
    );
  }
  return trimmed;
}

function validateLanguage(lang: string): string {
  const lower = lang.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(lower)) {
    throw ApiError.badRequest(
      `Unsupported language: "${lang}". Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`,
    );
  }
  return lower;
}

/** Build the to_tsvector expression for the given table + columns + language. */
function tsvectorExpr(table: string, columns: string[], lang: string): string {
  const concat = columns.map((c) => `"${table}"."${c}"`).join(" || ' ' || ");
  return `to_tsvector('${lang}', ${concat})`;
}

/**
 * Full-text search service — PostgreSQL native full-text search.
 *
 * Creates GIN indexes on user tables using to_tsvector, then searches
 * with to_tsquery / plainto_tsquery. No embeddings, no external services.
 *
 * Supports:
 *   - Create/drop/list full-text indexes on any user table
 *   - Keyword search with boolean operators (AND, OR, NOT)
 *   - Natural language search (plainto_tsquery)
 *   - Relevance ranking (ts_rank)
 *   - Result limiting
 */
export class FulltextService {
  constructor(private readonly db: Knex) {}

  /** Create a full-text GIN index on the specified table columns. */
  async createIndex(
    userId: string,
    input: { name: string; tableName: string; columns: string[]; language?: string },
  ): Promise<FulltextIndex> {
    const name = validateIndexName(input.name);
    const table = validateTable(input.tableName);
    const columns = validateColumns(input.columns);
    const lang = validateLanguage(input.language ?? 'english');

    // Check the table exists.
    const tableExists = await this.db
      .raw(`SELECT 1 FROM information_schema.tables WHERE table_name = ?`, [table])
      .then((r) => (r.rows as Array<{ count: number }>).length > 0 || (r.rows as unknown[]).length > 0)
      .catch(() => false);
    if (!tableExists) {
      throw ApiError.notFound(`Table "${table}" does not exist`);
    }

    // Check for existing index with same name.
    const existing = await this.db<IndexRow>('vortex_fulltext_indexes')
      .where({ user_id: userId, name })
      .first();
    if (existing) {
      throw ApiError.conflict(`Full-text index "${name}" already exists on table "${table}"`);
    }

    const physicalName = `fts_${table}_${name}`.slice(0, 60);
    const expr = tsvectorExpr(table, columns, lang);

    // Create the GIN index.
    try {
      await this.db.raw(
        `CREATE INDEX "${physicalName}" ON "${table}" USING gin (${expr})`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        throw ApiError.conflict(`A GIN index named "${physicalName}" already exists`);
      }
      throw ApiError.badRequest(`Failed to create full-text index: ${msg}`);
    }

    const [row] = await this.db<IndexRow>('vortex_fulltext_indexes')
      .insert({
        user_id: userId,
        table_name: table,
        name,
        columns: JSON.stringify(columns) as unknown as string[],
        language: lang,
        index_name: physicalName,
      })
      .returning('*');

    return toIndex(row!);
  }

  /** List all full-text indexes for the user. */
  async listIndexes(userId: string): Promise<FulltextIndex[]> {
    const rows = await this.db<IndexRow>('vortex_fulltext_indexes')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    return rows.map(toIndex);
  }

  /** Drop a full-text index (drops the GIN index + registry row). */
  async dropIndex(userId: string, name: string): Promise<void> {
    const row = await this.db<IndexRow>('vortex_fulltext_indexes')
      .where({ user_id: userId, name })
      .first();
    if (!row) throw ApiError.notFound(`Full-text index "${name}" not found`);

    try {
      await this.db.raw(`DROP INDEX IF EXISTS "${row.index_name}"`);
    } catch (err) {
      // Non-fatal — the registry row is removed regardless.
      console.warn(`[vortex] failed to drop GIN index ${row.index_name}:`, (err as Error).message);
    }

    await this.db('vortex_fulltext_indexes').where({ id: row.id }).del();
  }

  /**
   * Search a table using full-text query.
   * Uses the index if one exists, otherwise does a full scan.
   */
  async search(
    userId: string,
    input: {
      tableName: string;
      query: string;
      columns?: string[];
      language?: string;
      limit?: number;
      mode?: 'match' | 'plain'; // match = to_tsquery (boolean), plain = plainto_tsquery (natural language)
    },
  ): Promise<FulltextSearchResult[]> {
    const table = validateTable(input.tableName);
    const lang = validateLanguage(input.language ?? 'english');
    const limit = Math.min(input.limit ?? 20, 100);
    const mode = input.mode ?? 'match';

    // Check the table exists.
    const tableExists = await this.db
      .raw(`SELECT 1 FROM information_schema.tables WHERE table_name = ?`, [table])
      .then((r) => (r.rows as unknown[]).length > 0)
      .catch(() => false);
    if (!tableExists) {
      throw ApiError.notFound(`Table "${table}" does not exist`);
    }

    // Try to find an existing index for this table.
    const indexRow = await this.db<IndexRow>('vortex_fulltext_indexes')
      .where({ user_id: userId, table_name: table })
      .first();

    let columns: string[];
    if (indexRow) {
      columns = Array.isArray(indexRow.columns) ? indexRow.columns : JSON.parse(indexRow.columns);
    } else {
      // Fallback: use provided columns or default to 'text' column if it exists.
      columns = input.columns ?? ['text'];
      columns = validateColumns(columns);
    }

    const expr = tsvectorExpr(table, columns, lang);
    const queryFn = mode === 'plain' ? 'plainto_tsquery' : 'websearch_to_tsquery';
    const safeQuery = input.query.replace(/'/g, "''");

    // Escape single quotes in the query for SQL.
    const result = await this.db.raw(
      `SELECT *, ts_rank(${expr}, ${queryFn}('${lang}', '${safeQuery}')) as rank
       FROM "${table}"
       WHERE ${expr} @@ ${queryFn}('${lang}', '${safeQuery}')
       ORDER BY rank DESC
       LIMIT ${limit}`,
    );

    const rows = result.rows as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id ?? ''),
      rank: Number(row.rank ?? 0),
      row,
    }));
  }
}

import { useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import {
  Banner,
  Chip,
  GradientButton,
  PageTitle,
} from '../components/Glass.js';

interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

const SAMPLES = [
  { label: 'tables', sql: "select table_name from information_schema.tables where table_schema = 'public' order by 1" },
  { label: 'row counts', sql: "select relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc limit 20" },
  { label: 'users', sql: 'select id, email, role, created_at from users limit 20' },
];

/** SQL Console — run statements straight against the engine database. */
export function SqlPage({ isAdmin }: { isAdmin: boolean }) {
  const [sql, setSql] = useState('select now() as vortex_time');
  const [params, setParams] = useState('');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let parsedParams: unknown[] | undefined;
      if (params.trim()) {
        parsedParams = JSON.parse(params) as unknown[];
        if (!Array.isArray(parsedParams)) throw new Error('Params must be a JSON array');
      }
      const res = await api.post<SqlResult>('/v1/sql', { sql, params: parsedParams });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="SQL"
        accent="Console"
        subtitle="Raw SQL against the engine database — parameterized, single statement, admin only."
      />

      {!isAdmin && (
        <Banner tone="info">
          The SQL console is restricted to <b>admin</b> accounts. Ask an admin for the role, or use
          the Database explorer for query-builder access.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="glass p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">samples</div>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setSql(s.sql)}
              className="btn-glass px-2.5 py-1 text-[10px]"
            >
              {s.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              value={params}
              onChange={(e) => setParams(e.target.value)}
              placeholder='params JSON e.g. [42]'
              className="input-vortex w-44 px-3 py-1.5 font-mono text-[11px]"
            />
            <GradientButton onClick={() => void run()} disabled={busy || !sql.trim() || !isAdmin}>
              {busy ? 'Running…' : 'Run SQL'}
            </GradientButton>
          </div>
        </div>

        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          rows={8}
          className="console-core mt-4 w-full resize-y p-4 font-mono text-[12px] leading-relaxed text-spectrum-cyan outline-none"
        />
      </div>

      {result && (
        <div className="glass overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3">
            <Chip tone="green">{result.rowCount} rows</Chip>
            <Chip tone="cyan">{result.durationMs} ms</Chip>
            <div className="text-[10px] text-slate-500">
              $1..$n and ? placeholders both supported
            </div>
          </div>
          {result.rows.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500">
              statement returned no rows
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {result.columns.map((c) => (
                        <td key={c} className="font-mono">
                          {formatCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

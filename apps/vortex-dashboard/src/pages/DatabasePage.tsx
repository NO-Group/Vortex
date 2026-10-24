import { useState, type FormEvent } from 'react';
import { api, ApiError, type QueryResult } from '../lib/api.js';
import { Banner, GlassButton, GradientButton, PageTitle, Chip } from '../components/Glass.js';
import { DataTable } from '../components/DataTable.js';

interface FilterRow {
  column: string;
  op: string;
  value: string;
}

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'is'];

export function DatabasePage() {
  const [table, setTable] = useState('notes');
  const [filters, setFilters] = useState<FilterRow[]>([{ column: 'title', op: 'like', value: '%' }]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [insertTitle, setInsertTitle] = useState('');
  // Create Table modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState<Array<{ name: string; type: string }>>([
    { name: 'title', type: 'text' },
    { name: 'body', type: 'text' },
  ]);

  const runQuery = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const active = filters.filter((f) => f.column.trim() !== '');
      const result = await api.post<QueryResult>(`/v1/db/${encodeURIComponent(table)}/query`, {
        filters: active.map((f) => ({
          column: f.column.trim(),
          op: f.op,
          value:
            f.op === 'is'
              ? null
              : f.op === 'in'
                ? f.value.split(',').map((v) => v.trim())
                : isNaN(Number(f.value)) || f.value === ''
                  ? f.value
                  : Number(f.value),
        })),
        limit: 100,
      });
      setRows(result.rows);
      setCount(result.count);
    } catch (err) {
      setRows([]);
      setCount(null);
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Query failed');
    } finally {
      setBusy(false);
    }
  };

  const createTable = async () => {
    if (!newTableName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const cols = newColumns.filter((c) => c.name.trim());
      await api.post(`/v1/db/${encodeURIComponent(newTableName.trim())}/create`, {
        columns: cols.map((c) => ({
          name: c.name.trim(),
          type: c.type as 'text' | 'jsonb' | 'integer' | 'boolean' | 'timestamptz',
        })),
      });
      setShowCreate(false);
      setNewTableName('');
      setTable(newTableName.trim());
      await runQuery();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Create table failed');
    } finally {
      setBusy(false);
    }
  };

  const insertRow = async () => {
    if (!insertTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/v1/db/${encodeURIComponent(table)}`, {
        rows: [{ title: insertTitle.trim(), body: { source: 'console' } }],
      });
      setInsertTitle('');
      await runQuery();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Insert failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (row: Record<string, unknown>) => {
    const id = row.id;
    if (!id) {
      setError('Row has no "id" column — manual delete unavailable');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.del(`/v1/db/${encodeURIComponent(table)}`, {
        filters: [{ column: 'id', value: id }],
      });
      await runQuery();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle
          title="Database"
          accent="Explorer"
          subtitle="Dynamic CRUD over PostgreSQL — filters, JSONB, RBAC-scoped rows."
        />
        <GradientButton onClick={() => setShowCreate(true)} disabled={busy}>
          + Create Table
        </GradientButton>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Query builder */}
        <div className="glass p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Query Builder
          </div>

          <label className="mt-4 block text-[10px] uppercase tracking-widest text-slate-500">
            Table
          </label>
          <input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="input-vortex mt-1.5 w-full px-3 py-2 font-mono text-[12px]"
            placeholder="notes"
          />

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-slate-500">Filters</label>
              <button
                onClick={() => setFilters((f) => [...f, { column: '', op: 'eq', value: '' }])}
                className="text-[11px] text-interactive-focus transition hover:text-blue-300"
              >
                + add filter
              </button>
            </div>

            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={f.column}
                  onChange={(e) =>
                    setFilters((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, column: e.target.value } : r)),
                    )
                  }
                  placeholder="column"
                  className="input-vortex w-full px-2.5 py-1.5 font-mono text-[11px]"
                />
                <select
                  value={f.op}
                  onChange={(e) =>
                    setFilters((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, op: e.target.value } : r)),
                    )
                  }
                  className="input-vortex px-2 py-1.5 font-mono text-[11px]"
                >
                  {OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  value={f.value}
                  onChange={(e) =>
                    setFilters((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                    )
                  }
                  placeholder="value"
                  disabled={f.op === 'is'}
                  className="input-vortex w-full px-2.5 py-1.5 font-mono text-[11px]"
                />
                <button
                  onClick={() => setFilters((rows) => rows.filter((_, j) => j !== i))}
                  className="px-1 text-slate-600 transition hover:text-spectrum-coral"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <GradientButton onClick={() => void runQuery()} disabled={busy} className="mt-5 w-full">
            {busy ? 'Running…' : '▶ Run Query'}
          </GradientButton>

          <div className="mt-5 border-t border-white/[0.07] pt-4">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              Quick insert (title)
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <input
                value={insertTitle}
                onChange={(e) => setInsertTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void insertRow()}
                placeholder="new row title…"
                className="input-vortex w-full px-2.5 py-1.5 text-[11px]"
              />
              <GlassButton onClick={() => void insertRow()} disabled={busy || !insertTitle.trim()}>
                Insert
              </GlassButton>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4 lg:col-span-2">
          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Chip tone="cyan">{table}</Chip>
              {count !== null && <Chip tone="green">{count} rows</Chip>}
            </div>
            <GlassButton onClick={() => void runQuery()} disabled={busy}>
              ↻ Refresh
            </GlassButton>
          </div>

          <div className="glass p-3">
            <DataTable rows={rows} onDelete={(row) => void deleteRow(row)} />
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Rows are RBAC-scoped: owner columns (e.g. <span className="font-mono">owner_id</span>)
            are auto-filled on insert and enforced on select/update/delete. System tables
            (<span className="font-mono">users</span>, <span className="font-mono">table_permissions</span>,
            <span className="font-mono">storage_objects</span>) are protected from non-admin writes.
          </p>
        </div>
      </div>

      {/* Create Table modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="glass w-full max-w-lg rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-white">Create Table</div>
            <div className="text-sm text-slate-400">
              Define a new table with custom columns. Auto-adds id, owner_id, created_at, updated_at.
            </div>

            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-widest text-slate-500">
                Table name
              </label>
              <input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="input-vortex mt-1.5 w-full px-3 py-2 font-mono text-[12px]"
                placeholder="notes"
                autoFocus
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
                  Columns
                </label>
                <button
                  onClick={() =>
                    setNewColumns((c) => [...c, { name: '', type: 'text' }])
                  }
                  className="text-[11px] text-interactive-focus hover:text-blue-300"
                >
                  + add column
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {newColumns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={col.name}
                      onChange={(e) =>
                        setNewColumns((cols) =>
                          cols.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)),
                        )
                      }
                      placeholder="column name"
                      className="input-vortex w-full px-2.5 py-1.5 font-mono text-[11px]"
                    />
                    <select
                      value={col.type}
                      onChange={(e) =>
                        setNewColumns((cols) =>
                          cols.map((c, j) => (j === i ? { ...c, type: e.target.value } : c)),
                        )
                      }
                      className="input-vortex w-28 px-2 py-1.5 text-[11px]"
                    >
                      <option value="text">text</option>
                      <option value="jsonb">jsonb</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                      <option value="timestamptz">timestamptz</option>
                    </select>
                    <button
                      onClick={() => setNewColumns((c) => c.filter((_, j) => j !== i))}
                      className="text-spectrum-coral text-[12px] hover:opacity-80"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <GlassButton onClick={() => setShowCreate(false)}>Cancel</GlassButton>
              <GradientButton onClick={() => void createTable()} disabled={busy || !newTableName.trim()}>
                Create
              </GradientButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

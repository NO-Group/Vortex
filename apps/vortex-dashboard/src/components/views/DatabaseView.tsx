import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';

/**
 * Vortex Dashboard — Database Explorer view.
 *
 * Select a table, view rows, and insert new records — all through the
 * Vortex DB API with RBAC enforcement.
 */

export function DatabaseView() {
  const [tableName, setTableName] = useState('users');
  const [tables, setTables] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInsert, setShowInsert] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});

  const loadTables = useCallback(async () => {
    // Common Vortex tables to suggest
    setTables(['users', 'storage_objects']);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.selectTable(tableName, 100);
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rows');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (tableName) loadRows();
  }, [tableName, loadRows]);

  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert string values to appropriate types
      const typedRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(newRow)) {
        typedRow[k] = v;
      }
      await api.insertRow(tableName, typedRow);
      setNewRow({});
      setShowInsert(false);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert row');
    }
  };

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader title="Database" subtitle="Browse and manage table records" />

      <div className="glass p-5">
        {/* Table selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            Table
          </label>
          <select
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="glass-input flex-1 py-2 text-sm"
          >
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button onClick={loadRows} className="btn-glass !py-2 !px-4 text-sm">
            Refresh
          </button>
          <button onClick={() => setShowInsert(!showInsert)} className="btn-primary !py-2 !px-4 text-sm">
            + Insert
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Insert form */}
        {showInsert && (
          <form onSubmit={handleInsert} className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-xs font-medium text-white/40">New row</p>
            <div className="grid grid-cols-2 gap-3">
              {columns.map((col) => (
                <div key={col} className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-wider text-white/30">{col}</label>
                  <input
                    type="text"
                    value={newRow[col] ?? ''}
                    onChange={(e) => setNewRow((prev) => ({ ...prev, [col]: e.target.value }))}
                    className="glass-input !py-2 text-sm"
                    placeholder={`Enter ${col}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">Insert Row</button>
              <button type="button" onClick={() => setShowInsert(false)} className="btn-glass !py-2 !px-4 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Data table */}
        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/25">No rows in this table</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-3 text-left font-medium uppercase tracking-wider text-white/30">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-3 text-white/60">
                        {String(row[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-xs text-white/20">
          {rows.length} row{rows.length !== 1 ? 's' : ''} loaded
        </p>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-sm text-white/30">{subtitle}</p>
    </div>
  );
}

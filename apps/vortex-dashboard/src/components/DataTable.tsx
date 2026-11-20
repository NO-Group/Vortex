import { formatDateTime } from '../lib/format.js';

/**
 * Data grid for query results — solid, sharp, zero glass bleed
 * (per the design spec: data-intensive surfaces stay legible).
 */
export function DataTable({
  rows,
  onDelete,
}: {
  rows: Record<string, unknown>[];
  onDelete?: (row: Record<string, unknown>) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        no rows match this query
      </div>
    );
  }

  const columns = Object.keys(rows[0]!);

  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return '∅';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="max-h-[520px] overflow-auto rounded-[12px] border border-white/[0.06]">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
            {onDelete && <th aria-label="actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => {
                const value = row[col];
                const isTime = /(_at|timestamp)$/i.test(col) && typeof value === 'string';
                return (
                  <td key={col} title={cell(value)}>
                    {isTime ? formatDateTime(value as string) : cell(value)}
                  </td>
                );
              })}
              {onDelete && (
                <td className="w-10">
                  <button
                    onClick={() => onDelete(row)}
                    className="rounded-md px-2 py-0.5 text-[10px] text-slate-500 transition hover:bg-spectrum-coral/10 hover:text-spectrum-coral"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

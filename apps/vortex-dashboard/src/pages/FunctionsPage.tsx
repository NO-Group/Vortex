import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, getToken } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassButton,
  GradientButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';
import { formatDateTime } from '../lib/format.js';

interface FunctionMeta {
  id: string;
  name: string;
  title: string;
  status: 'active' | 'paused';
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STARTER = `async (req, ctx) => {
  // req: { method, path, query, headers, body, user }
  // ctx: { data, storage, env } — service-level helpers
  return { status: 200, body: { hello: req.query.name ?? 'world' } };
}`;

/** Vortex Functions — deploy server functions, invoke them live. */
export function FunctionsPage() {
  const [functions, setFunctions] = useState<FunctionMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState(STARTER);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [invokeQuery, setInvokeQuery] = useState('');
  const [invokeResult, setInvokeResult] = useState<{ status: number; body: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ functions: FunctionMeta[] }>('/v1/functions');
      setFunctions(res.functions);
    } catch (err) {
      setFunctions([]);
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Could not list functions');
    }
  }, []);

  const loadSource = useCallback(async (fnName: string) => {
    try {
      const res = await api.get<{ source: string }>(`/v1/functions/${encodeURIComponent(fnName)}`);
      setSource(res.source);
    } catch {
      setSource(STARTER);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selected) void loadSource(selected);
  }, [selected, loadSource]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ function: FunctionMeta }>('/v1/functions', {
        name: name.trim(),
        title: title.trim() || undefined,
        source,
      });
      setName('');
      setTitle('');
      setNotice(`Function "${res.function.name}" deployed — invoke it below or at /functions/${res.function.name}`);
      setSelected(res.function.name);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Deploy failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSource = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/v1/functions/${encodeURIComponent(selected)}`, { source });
      setNotice('Source saved.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (fn: FunctionMeta) => {
    setBusy(true);
    try {
      await api.patch(`/v1/functions/${encodeURIComponent(fn.name)}`, {
        status: fn.status === 'active' ? 'paused' : 'active',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (fnName: string) => {
    setBusy(true);
    try {
      await api.del(`/v1/functions/${encodeURIComponent(fnName)}`);
      if (selected === fnName) setSelected(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const invoke = async () => {
    if (!selected) return;
    setBusy(true);
    setInvokeResult(null);
    try {
      const token = getToken();
      const qs = invokeQuery ? `?${invokeQuery.replace(/^\?/, '')}` : '';
      const res = await fetch(`/functions/${encodeURIComponent(selected)}${qs}`, {
        headers: token ? { 'x-vortex-token': token } : {},
      });
      const body = await res.text();
      setInvokeResult({ status: res.status, body });
    } catch (err) {
      setInvokeResult({ status: 0, body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Vortex"
        accent="Functions"
        subtitle="Server functions run by the engine — deploy source, invoke over HTTP at /functions/<name>."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="glass flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-slate-500">
            Function name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="hello-world"
            className="input-vortex w-48 px-3 py-2 font-mono text-[12px]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-slate-500">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hello World"
            className="input-vortex w-48 px-3 py-2 text-[12px]"
          />
        </div>
        <GradientButton onClick={() => void create()} disabled={busy || !name.trim()}>
          Deploy Function
        </GradientButton>
      </div>

      {functions === null ? (
        <Skeleton className="h-24" />
      ) : functions.length === 0 ? (
        <div className="glass flex h-32 flex-col items-center justify-center text-slate-500">
          <div className="text-sm">no functions deployed</div>
          <div className="mt-1 text-[11px]">
            a function is an async (req, ctx) =&gt; response expression
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {functions.map((fn) => (
            <div
              key={fn.id}
              onClick={() => setSelected(fn.name)}
              className={`glass glass-hover cursor-pointer p-4 ${
                selected === fn.name ? 'border-interactive-focus/50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[13px] font-semibold text-white">{fn.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{fn.title}</div>
                </div>
                <Chip tone={fn.status === 'active' ? 'green' : 'default'}>{fn.status}</Chip>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                updated {formatDateTime(fn.updatedAt)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleStatus(fn);
                  }}
                  className="btn-glass px-2.5 py-1 text-[10px]"
                >
                  {fn.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(fn.name);
                  }}
                  className="rounded-md px-2 py-1 text-[10px] text-slate-500 transition hover:bg-spectrum-coral/10 hover:text-spectrum-coral"
                >
                  Delete
                </button>
                <a
                  href={`/functions/${fn.name}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-[10px] text-interactive-focus hover:text-blue-300"
                >
                  /functions/{fn.name} ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Chip tone="cyan">{selected}</Chip>
            <GlassButton onClick={() => void loadSource(selected)}>↻ Reload source</GlassButton>
          </div>

          <div className="glass p-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              source — async (req, ctx) =&gt; response
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              rows={12}
              className="console-core mt-3 w-full resize-y p-4 font-mono text-[11px] leading-relaxed text-spectrum-mint outline-none"
            />
            <div className="mt-3 flex items-center gap-2">
              <GradientButton onClick={() => void saveSource()} disabled={busy}>
                {busy ? 'Working…' : 'Save Source'}
              </GradientButton>
              <span className="text-[10px] text-slate-500">
                Return {'{ status, headers, body }'} · a string · or any JSON value
              </span>
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">invoke</div>
              <input
                value={invokeQuery}
                onChange={(e) => setInvokeQuery(e.target.value)}
                placeholder="query string e.g. name=vortex"
                className="input-vortex w-64 px-3 py-1.5 font-mono text-[11px]"
              />
              <GradientButton onClick={() => void invoke()} disabled={busy}>
                Call
              </GradientButton>
            </div>
            {invokeResult && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <Chip tone={invokeResult.status < 400 ? 'green' : 'coral'}>HTTP {invokeResult.status}</Chip>
                </div>
                <pre className="console-core mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] text-spectrum-cyan">
                  {invokeResult.body || '(empty response)'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { api, ApiError, getToken } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassButton,
  GradientButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';
import { formatBytes, formatDateTime } from '../lib/format.js';

interface AppMeta {
  id: string;
  name: string;
  title: string;
  ownerId: string | null;
  createdAt: string;
}

interface AppFileMeta {
  id: string;
  appId: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string;
}

/** Deploy one file to an app (raw body upload). */
async function uploadAppFile(name: string, path: string, file: File): Promise<void> {
  const token = getToken();
  const res = await fetch(
    `/v1/apps/${encodeURIComponent(name)}/files?path=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        ...(token ? { authorization: `Bearer ${token}`, 'x-vortex-token': token } : {}),
      },
      body: file,
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'upload_failed',
      body?.error?.message ?? `Upload failed for ${path}`,
    );
  }
}

export function AppsPage() {
  const [apps, setApps] = useState<AppMeta[] | null>(null);
  const [files, setFiles] = useState<AppFileMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ apps: AppMeta[] }>('/v1/apps');
      setApps(res.apps);
    } catch (err) {
      setApps([]);
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Could not list apps');
    }
  }, []);

  const loadFiles = useCallback(async (appName: string) => {
    try {
      const res = await api.get<{ files: AppFileMeta[] }>(
        `/v1/apps/${encodeURIComponent(appName)}/files`,
      );
      setFiles(res.files);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selected) {
      setFiles(null);
      void loadFiles(selected);
    }
  }, [selected, loadFiles]);

  const createApp = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ app: AppMeta }>('/v1/apps', {
        name: name.trim(),
        title: title.trim() || undefined,
      });
      setName('');
      setTitle('');
      setNotice(`App "${res.app.name}" created — deploy files to go live.`);
      setSelected(res.app.name);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const deploy = async (fileList: FileList | File[]) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let count = 0;
      for (const file of Array.from(fileList)) {
        const path =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        await uploadAppFile(selected, path, file);
        count++;
      }
      setNotice(`Deployed ${count} file${count === 1 ? '' : 's'} to ${selected}.`);
      await loadFiles(selected);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Deploy failed');
    } finally {
      setBusy(false);
    }
  };

  /** One-click deploy: fetches the Vortex Notes showcase app and deploys it. */
  const deployShowcase = async () => {
    const appName = 'vortex-notes';
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Create the app if it doesn't exist
      let existing = apps?.find((a) => a.name === appName);
      if (!existing) {
        const res = await api.post<{ app: AppMeta }>('/v1/apps', {
          name: appName,
          title: 'Vortex Notes — Built on Vortex BaaS',
        });
        existing = res.app;
        await refresh();
      }
      setSelected(appName);

      // Fetch the showcase app from the repo
      const res = await fetch(
        `${window.location.origin}/api/showcase/index.html`,
      );
      if (!res.ok) throw new Error('Could not fetch showcase app');
      const html = await res.text();

      // Deploy the HTML file
      const blob = new Blob([html], { type: 'text/html' });
      await uploadAppFile(appName, 'index.html', blob as unknown as File);

      setNotice(`Vortex Notes showcase deployed to /apps/${appName} — open it to see a real app on Vortex.`);
      await loadFiles(appName);
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Showcase deploy failed');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void deploy(e.dataTransfer.files);
  };

  const removeApp = async (appName: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/v1/apps/${encodeURIComponent(appName)}`);
      if (selected === appName) {
        setSelected(null);
        setFiles(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (path: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.del(
        `/v1/apps/${encodeURIComponent(selected)}/files?path=${encodeURIComponent(path)}`,
      );
      await loadFiles(selected);
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Vortex"
        accent="Apps"
        subtitle="Deploy static web apps — each app is live at /apps/<name>/ with SPA routing."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* Create */}
      <div className="glass flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-slate-500">
            App name (slug)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-next-app"
            className="input-vortex w-52 px-3 py-2 font-mono text-[12px]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-slate-500">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Next App"
            className="input-vortex w-56 px-3 py-2 text-[12px]"
          />
        </div>
        <GradientButton onClick={() => void createApp()} disabled={busy || !name.trim()}>
          Create App
        </GradientButton>
      </div>

      {/* One-click showcase deploy */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-[13px] font-medium">Deploy Vortex Notes Showcase</div>
          <div className="font-mono text-[10px] text-slate-500">
            A real app built on Vortex — auth, database, realtime, storage, push
          </div>
        </div>
        <GradientButton onClick={() => void deployShowcase()} disabled={busy}>
          One-Click Deploy
        </GradientButton>
      </div>

      {/* App grid */}
      {apps === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : apps.length === 0 ? (
        <div className="glass flex h-40 flex-col items-center justify-center text-slate-500">
          <div className="text-sm">no apps yet</div>
          <div className="mt-1 text-[11px]">create one above, then drop a build folder to deploy</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className={`glass glass-hover cursor-pointer p-5 ${
                selected === app.name ? 'border-interactive-focus/50' : ''
              }`}
              onClick={() => setSelected(app.name)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[13px] font-semibold text-white">{app.name}</div>
                  <div className="mt-0.5 text-[12px] text-slate-400">{app.title}</div>
                </div>
                <Chip tone={selected === app.name ? 'blue' : 'default'}>
                  {selected === app.name ? 'selected' : 'app'}
                </Chip>
              </div>
              <div className="mt-3 text-[10px] text-slate-500">
                created {formatDateTime(app.createdAt)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={`/apps/${app.name}/`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="btn-glass px-3 py-1.5 text-[11px]"
                >
                  Open ↗
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeApp(app.name);
                  }}
                  disabled={busy}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:bg-spectrum-coral/10 hover:text-spectrum-coral"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files of selected app */}
      {selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Chip tone="cyan">{selected}</Chip>
              <Chip tone="green">{files?.length ?? 0} files</Chip>
            </div>
            <GlassButton onClick={() => void loadFiles(selected)}>↻ Refresh</GlassButton>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`glass glass-hover flex cursor-pointer flex-col items-center justify-center border-dashed px-6 py-8 text-center transition ${
              dragging ? 'border-interactive-focus bg-interactive-focus/10' : ''
            }`}
          >
            <div className="text-sm text-slate-300">
              Drop files or a build folder here to deploy to <b className="text-white">{selected}</b>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              index.html goes live at /apps/{selected}/ · SPA routes fall back to index.html
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void deploy(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <div className="glass overflow-hidden">
            {files === null ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                no files deployed yet
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>path</th>
                    <th>type</th>
                    <th>size</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td className="font-mono">{f.path}</td>
                      <td className="text-slate-500">{f.contentType}</td>
                      <td>{formatBytes(f.size)}</td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            onClick={() => void removeFile(f.path)}
                            disabled={busy}
                            className="rounded-md px-2 py-0.5 text-[10px] text-slate-500 transition hover:bg-spectrum-coral/10 hover:text-spectrum-coral"
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center gap-2">
            <GradientButton onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Deploying…' : 'Deploy Files'}
            </GradientButton>
            <a
              href={`/apps/${selected}/`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-interactive-focus transition hover:text-blue-300"
            >
              preview /apps/{selected}/ ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

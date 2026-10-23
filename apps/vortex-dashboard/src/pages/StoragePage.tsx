import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  api,
  ApiError,
  type PresignedUrl,
  type StorageObject,
} from '../lib/api.js';
import {
  Banner,
  GlassButton,
  GradientButton,
  PageTitle,
  Chip,
  Skeleton,
} from '../components/Glass.js';
import { formatBytes, formatDateTime, shortId } from '../lib/format.js';

export function StoragePage() {
  const [objects, setObjects] = useState<StorageObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.get<{ objects: StorageObject[] }>('/v1/storage/list');
      setObjects(list.objects);
    } catch (err) {
      setObjects([]);
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Could not list objects');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const key = `uploads/${Date.now()}-${file.name}`;
      await api.upload(key, file);
      setNotice(`Uploaded ${key} (${formatBytes(file.size)})`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  };

  const download = async (key: string) => {
    setError(null);
    try {
      const presigned = await api.post<PresignedUrl>('/v1/storage/presign-download', { key });
      // Normalize protocol — TLS is often terminated upstream of the engine.
      const url = new URL(presigned.url);
      if (location.protocol === 'https:') url.protocol = 'https:';
      window.open(url.toString(), '_blank');
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Presign failed');
    }
  };

  const remove = async (key: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.del('/v1/storage/object', { key });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Storage"
        accent="Gateway"
        subtitle="Presigned upload/download URLs — local disk or S3-compatible buckets."
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`glass glass-hover flex cursor-pointer flex-col items-center justify-center border-dashed px-6 py-10 text-center transition ${
          dragging ? 'border-interactive-focus bg-interactive-focus/10' : ''
        }`}
      >
        <div className="gradient-ring h-12 w-12 rounded-full">
          <div className="flex h-full w-full items-center justify-center rounded-full text-lg text-spectrum-cyan">
            ↑
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-300">
          Drop a file here, or <span className="text-interactive-focus">browse</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-slate-500">
          POST /v1/storage/upload · max 64 MiB
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Chip tone="coral">your objects</Chip>
          {objects && <Chip>{objects.length} total</Chip>}
        </div>
        <GlassButton onClick={() => void refresh()}>↻ Refresh</GlassButton>
      </div>

      <div className="glass overflow-hidden">
        {objects === null ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : objects.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-slate-500">
            <div className="text-sm">no objects yet</div>
            <div className="mt-1 text-[11px]">upload something to light up the bucket</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>key</th>
                <th>type</th>
                <th>size</th>
                <th>created</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {objects.map((obj) => (
                <tr key={obj.id}>
                  <td title={obj.key} className="font-mono">
                    {obj.key.length > 42 ? shortId(obj.key, 42) : obj.key}
                  </td>
                  <td className="text-slate-500">{obj.contentType}</td>
                  <td>{formatBytes(obj.size)}</td>
                  <td className="text-slate-500">{formatDateTime(obj.createdAt)}</td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void download(obj.key)}
                        className="rounded-md px-2 py-0.5 text-[10px] text-slate-400 transition hover:bg-interactive-focus/10 hover:text-blue-300"
                      >
                        presign GET
                      </button>
                      <button
                        onClick={() => void remove(obj.key)}
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
          {busy ? 'Working…' : 'Upload Object'}
        </GradientButton>
        <span className="text-[11px] text-slate-500">
          Presigned URLs expire in 15 minutes · HMAC-signed on the local driver
        </span>
      </div>
    </div>
  );
}

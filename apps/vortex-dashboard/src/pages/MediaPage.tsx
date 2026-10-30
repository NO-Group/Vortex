import { useState, useCallback } from 'react';
import { api } from '../lib/api.js';

interface Transformation {
  id: string;
  key: string;
  operation: string;
  params: Record<string, unknown>;
  outputKey: string;
  status: string;
  webhookStatus: string | null;
  createdAt: string;
}

export function MediaPage() {
  const [key, setKey] = useState('');
  const [totalChunks, setTotalChunks] = useState(3);
  const [uploadId, setUploadId] = useState('');
  const [chunkProgress, setChunkProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState('');

  const [transformKey, setTransformKey] = useState('');
  const [transformOp, setTransformOp] = useState('resize');
  const [transformParams, setTransformParams] = useState('{"width": 800, "height": 600}');
  const [transforms, setTransforms] = useState<Transformation[]>([]);
  const [bulkKeys, setBulkKeys] = useState('');
  const [bulkResult, setBulkResult] = useState('');

  const initUpload = useCallback(async () => {
    try {
      const res = await api.post<{ uploadId: string }>('/v1/storage/chunked/init', {
        key, totalChunks, contentType: 'application/octet-stream',
      });
      setUploadId(res.uploadId);
      setChunkProgress(0);
      setUploadResult('Upload session created. Upload chunks then complete.');
    } catch (e) {
      setUploadResult(`✗ ${(e as Error).message}`);
    }
  }, [api, key, totalChunks]);

  const completeUpload = useCallback(async () => {
    try {
      const res = await api.post<{ object: { key: string; size: number } }>('/v1/storage/chunked/complete', { uploadId });
      setUploadResult(`✓ Upload complete: ${res.object.key} (${res.object.size} bytes)`);
      setUploadId('');
      setChunkProgress(0);
    } catch (e) {
      setUploadResult(`✗ ${(e as Error).message}`);
    }
  }, [api, uploadId]);

  const requestTransform = useCallback(async () => {
    try {
      const params = JSON.parse(transformParams);
      const res = await api.post<{ id: string; key: string; operation: string; params: Record<string, unknown>; outputKey: string; status: string; createdAt: string }>('/v1/storage/transformations', {
        key: transformKey, operation: transformOp, params,
      });
      setTransforms((prev) => [{
        id: res.id, key: res.key, operation: res.operation, params: res.params,
        outputKey: res.outputKey, status: res.status, webhookStatus: null,
        createdAt: res.createdAt,
      }, ...prev]);
    } catch (e) {
      setBulkResult(`✗ ${(e as Error).message}`);
    }
  }, [api, transformKey, transformOp, transformParams]);

  const loadTransforms = useCallback(async () => {
    try {
      const res = await api.get<{ transformations: Transformation[] }>('/v1/storage/transformations');
      setTransforms(res.transformations);
    } catch { /* ignore */ }
  }, [api]);

  const bulkDelete = useCallback(async () => {
    try {
      const keys = bulkKeys.split('\n').map((k) => k.trim()).filter(Boolean);
      const res = await api.post<{ deleted: string[]; failed: { key: string; error: string }[] }>('/v1/storage/bulk-delete', { keys });
      setBulkResult(`Deleted ${res.deleted.length} objects, ${res.failed.length} failed`);
      loadTransforms();
    } catch (e) {
      setBulkResult(`✗ ${(e as Error).message}`);
    }
  }, [api, bulkKeys]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Media & Storage</h1>
        <p className="text-sm text-slate-400">Chunked uploads, bulk deletion, and media transformations</p>
      </div>

      {/* Chunked Upload */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Chunked Upload</h2>
        <p className="text-xs text-slate-500">Multipart upload for large files — init, upload chunks, complete</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-slate-400">Object Key</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="uploads/video.mp4" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Total Chunks</label>
            <input type="number" value={totalChunks} onChange={(e) => setTotalChunks(parseInt(e.target.value) || 1)} min={1} max={1000} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={initUpload} className="rounded-lg bg-spectrum-cyan/20 px-4 py-2 text-sm font-medium text-spectrum-cyan transition hover:bg-spectrum-cyan/30">
            Init Upload
          </button>
          {uploadId && (
            <button onClick={completeUpload} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20">
              Complete Upload
            </button>
          )}
        </div>
        {uploadId && (
          <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <p className="font-mono text-xs text-slate-400">Upload ID: {uploadId}</p>
            <div className="mt-2 h-2 rounded-full bg-black/40">
              <div className="h-full rounded-full bg-spectrum-cyan/50 transition-all" style={{ width: `${(chunkProgress / totalChunks) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{chunkProgress}/{totalChunks} chunks received</p>
          </div>
        )}
        {uploadResult && <p className="mt-2 font-mono text-xs text-slate-400">{uploadResult}</p>}
      </div>

      {/* Bulk Delete */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Bulk Delete</h2>
        <p className="text-xs text-slate-500">Delete multiple objects at once (one key per line)</p>
        <textarea
          value={bulkKeys}
          onChange={(e) => setBulkKeys(e.target.value)}
          rows={4}
          placeholder="uploads/file1.mp4\nuploads/file2.png\nuploads/file3.jpg"
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-300"
        />
        <button onClick={bulkDelete} className="mt-3 rounded-lg border border-spectrum-coral/30 bg-spectrum-coral/10 px-4 py-2 text-sm font-medium text-spectrum-coral transition hover:bg-spectrum-coral/20">
          Delete Objects
        </button>
        {bulkResult && <p className="mt-2 font-mono text-xs text-slate-400">{bulkResult}</p>}
      </div>

      {/* Transformations */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Media Transformations</h2>
          <button onClick={loadTransforms} className="text-xs text-spectrum-cyan hover:underline">Refresh</button>
        </div>
        <p className="text-xs text-slate-500">Request image/video transformations (resize, crop, format, quality, rotate)</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-slate-400">Source Key</label>
            <input value={transformKey} onChange={(e) => setTransformKey(e.target.value)} placeholder="uploads/photo.jpg" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Operation</label>
            <select value={transformOp} onChange={(e) => setTransformOp(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
              <option value="resize">Resize</option>
              <option value="crop">Crop</option>
              <option value="format">Format</option>
              <option value="quality">Quality</option>
              <option value="rotate">Rotate</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-400">Params (JSON)</label>
            <textarea value={transformParams} onChange={(e) => setTransformParams(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-300" />
          </div>
        </div>
        <button onClick={requestTransform} className="mt-3 rounded-lg bg-spectrum-cyan/20 px-4 py-2 text-sm font-medium text-spectrum-cyan transition hover:bg-spectrum-cyan/30">
          Request Transformation
        </button>
        {transforms.length > 0 && (
          <div className="mt-4 space-y-2">
            {transforms.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                <div>
                  <span className="text-sm text-white">{t.operation}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{t.key} → {t.outputKey}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

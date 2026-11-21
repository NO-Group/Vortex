import { useState, useEffect, useCallback } from 'react';
import { api, type StorageObject } from '../../api';

/**
 * Vortex Dashboard — Storage Manager view.
 *
 * Browse owned objects, generate presigned upload URLs, and delete objects.
 */

export function StorageView() {
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadKey, setUploadKey] = useState('');
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  const loadObjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listObjects();
      setObjects(result.objects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  const handlePresign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadKey) return;
    try {
      const presigned = await api.presignUpload(uploadKey);
      setUploadUrl(presigned.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate upload URL');
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await api.deleteObject(key);
      await loadObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete object');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader title="Storage" subtitle="Manage your stored objects" />

      <div className="glass p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Upload section */}
        <div className="mb-5 flex justify-end">
          <button onClick={() => setShowUpload(!showUpload)} className="btn-primary !py-2 !px-4 text-sm">
            + Upload URL
          </button>
        </div>

        {showUpload && (
          <form onSubmit={handlePresign} className="mb-5 space-y-3 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-xs font-medium text-white/40">Generate a presigned upload URL</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={uploadKey}
                onChange={(e) => setUploadKey(e.target.value)}
                placeholder="objects/my-file.png"
                className="glass-input flex-1 !py-2 text-sm"
              />
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">Generate</button>
            </div>
            {uploadUrl && (
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-white/30">Presigned URL</label>
                <div className="break-all rounded-lg border border-cyber/20 bg-cyber/5 px-3 py-2 text-xs text-cyber">
                  {uploadUrl}
                </div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(uploadUrl); }}
                  className="text-xs text-focus hover:text-cyber"
                >
                  Copy URL
                </button>
              </div>
            )}
          </form>
        )}

        {/* Object list */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          ) : objects.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/25">No objects stored yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-white/30">Key</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-white/30">Size</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-white/30">Type</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-white/30">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj) => (
                  <tr key={obj.key} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/70">{obj.key}</td>
                    <td className="px-4 py-3 text-white/40">{formatSize(obj.size)}</td>
                    <td className="px-4 py-3 text-white/40">{obj.contentType}</td>
                    <td className="px-4 py-3 text-white/40">{new Date(obj.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(obj.key)}
                        className="text-xs text-white/30 transition-colors hover:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-xs text-white/20">
          {objects.length} object{objects.length !== 1 ? 's' : ''} · {formatSize(objects.reduce((sum, o) => sum + o.size, 0))} total
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

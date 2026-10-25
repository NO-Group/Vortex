import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, type VectorCollection } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassCard,
  GlassButton,
  GlassInput,
  GradientButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';

export default function VectorPage() {
  const [collections, setCollections] = useState<VectorCollection[]>([]);
  const [selected, setSelected] = useState<VectorCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create collection form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('1536');
  const [busy, setBusy] = useState(false);

  // Search form
  const [queryVector, setQueryVector] = useState('');
  const [searchLimit, setSearchLimit] = useState('5');
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ collections: VectorCollection[] }>('/v1/vector/collections');
      setCollections(res.collections);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !dimensions) return;
    setBusy(true);
    try {
      const res = await api.post<{ collection: VectorCollection }>('/v1/vector/collections', {
        name: name.trim(),
        description: description.trim() || undefined,
        dimensions: Number(dimensions),
      });
      setSelected(res.collection);
      setName('');
      setDescription('');
      setNotice('Collection created.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create collection');
    } finally {
      setBusy(false);
    }
  };

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || !queryVector.trim()) return;
    try {
      const vector = JSON.parse(queryVector) as number[];
      const res = await api.post<{ results: Array<Record<string, unknown>> }>(
        `/v1/vector/collections/${selected.id}/search`,
        { vector, limit: Number(searchLimit) },
      );
      setSearchResults(res.results);
      setSearched(true);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to search. Check that the vector is a valid JSON array of numbers.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageTitle title="Vector Search" accent="" subtitle="Semantic similarity for AI applications. Store embeddings and find similar vectors with cosine similarity." />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Create collection */}
        <GlassCard className="p-5">
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Create Collection</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Name</label>
              <GlassInput
                type="text"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="documents"
                maxLength={100}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Description</label>
              <GlassInput
                type="text"
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Dimensions</label>
              <GlassInput
                type="number"
                value={dimensions}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDimensions(e.target.value)}
                placeholder="1536 (OpenAI)"
                min="1"
                max="4096"
              />
            </div>
            <GradientButton type="submit" disabled={busy || !name.trim()} className="w-full">
              {busy ? 'Creating…' : 'Create Collection'}
            </GradientButton>
          </form>
        </GlassCard>

        {/* Collections list */}
        <GlassCard className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Collections ({collections.length})</h3>
            <GlassButton onClick={load} className="btn-secondary">Refresh</GlassButton>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : collections.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
              No collections yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {collections.map((col) => (
                <div
                  key={col.id}
                  onClick={() => setSelected(col)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: '10px',
                    background: selected?.id === col.id ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${selected?.id === col.id ? 'var(--vt-accent, #6366f1)' : 'var(--vt-border, rgba(255,255,255,0.08))'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{col.name}</div>
                    {col.description && (
                      <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                        {col.description}
                      </div>
                    )}
                  </div>
                  <Chip tone="cyan">{col.dimensions}d</Chip>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Selected collection — search */}
      {selected && (
        <GlassCard className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{selected.name}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)' }}>
                {selected.dimensions} dimensions · Click another collection to switch
              </p>
            </div>
            <Chip tone="cyan">{selected.dimensions}d</Chip>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                Query Vector (JSON array of numbers)
              </label>
              <textarea
                value={queryVector}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQueryVector(e.target.value)}
                placeholder='[0.1, 0.2, 0.3, ...]'
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--vt-border, rgba(255,255,255,0.1))',
                  color: 'var(--vt-text, #fff)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Limit</label>
              <GlassInput
                type="number"
                value={searchLimit}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchLimit(e.target.value)}
                placeholder="5"
                min="1"
                max="100"
                style={{ maxWidth: '100px' }}
              />
            </div>
            <GradientButton type="submit" disabled={!queryVector.trim()}>
              Search
            </GradientButton>
          </form>

          {searched && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Results ({searchResults.length})</h4>
              {searchResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
                  No results found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {searchResults.map((result, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--vt-border, rgba(255,255,255,0.08))',
                      }}
                    >
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>
                        {String(result.item_id)}
                      </div>
                      <div style={{ flex: 1 }}>
                        {result.payload ? (
                          <pre style={{ margin: 0, fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)' }}>
                            {String(JSON.stringify(result.payload, null, 2))}
                          </pre>
                        ) : null}
                      </div>
                      <Chip tone="green">
                        score: {(Number(result.score) ?? 0).toFixed(4)}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

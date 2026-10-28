import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, type FulltextIndex, type FulltextSearchResult } from '../lib/api.js';
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

const LANGUAGES = ['english', 'simple', 'german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'russian', 'chinese'];

export default function SearchPage() {
  const [indexes, setIndexes] = useState<FulltextIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create index form
  const [idxName, setIdxName] = useState('');
  const [tableName, setTableName] = useState('');
  const [columnsText, setColumnsText] = useState('');
  const [language, setLanguage] = useState('english');
  const [busy, setBusy] = useState(false);

  // Search panel
  const [searchTable, setSearchTable] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'match' | 'plain'>('match');
  const [searchLimit, setSearchLimit] = useState('20');
  const [searchResults, setSearchResults] = useState<FulltextSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ indexes: FulltextIndex[] }>('/v1/search/fulltext/index');
      setIndexes(res.indexes);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load indexes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateIndex = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!idxName.trim() || !tableName.trim() || !columnsText.trim()) return;
    setBusy(true);
    try {
      const columns = columnsText.split(',').map((c) => c.trim()).filter(Boolean);
      await api.post('/v1/search/fulltext/index', {
        name: idxName.trim(),
        tableName: tableName.trim(),
        columns,
        language,
      });
      setIdxName('');
      setTableName('');
      setColumnsText('');
      setNotice('Full-text index created.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create index');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteIndex = async (index: FulltextIndex) => {
    if (!confirm(`Drop index "${index.name}" on table "${index.tableName}"?`)) return;
    try {
      await api.del(`/v1/search/fulltext/index/${index.name}`);
      setNotice(`Index "${index.name}" dropped.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to drop index');
    }
  };

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTable.trim() || !searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const res = await api.post<{ results: FulltextSearchResult[]; count: number }>(
        '/v1/search/fulltext',
        {
          tableName: searchTable.trim(),
          query: searchQuery.trim(),
          mode: searchMode,
          limit: Number(searchLimit) || 20,
        },
      );
      setSearchResults(res.results);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageTitle
        title="Full-text Search"
        accent=""
        subtitle="PostgreSQL native keyword search with GIN indexes. Boolean or natural language queries — no embeddings needed."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Create index + index list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <GlassCard className="p-5">
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Create Full-text Index</h3>
            <form onSubmit={handleCreateIndex} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Index Name</label>
                <GlassInput
                  type="text"
                  value={idxName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setIdxName(e.target.value)}
                  placeholder="articles-fts"
                  maxLength={40}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Table Name</label>
                <GlassInput
                  type="text"
                  value={tableName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTableName(e.target.value)}
                  placeholder="articles"
                  maxLength={64}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Columns (comma-separated)</label>
                <GlassInput
                  type="text"
                  value={columnsText}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setColumnsText(e.target.value)}
                  placeholder="title, body"
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--vt-border, rgba(255,255,255,0.1))',
                    color: 'var(--vt-text, #fff)',
                    fontSize: '13px',
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <GradientButton type="submit" disabled={busy || !idxName.trim() || !tableName.trim() || !columnsText.trim()} className="w-full">
                {busy ? 'Creating…' : 'Create Index'}
              </GradientButton>
            </form>
          </GlassCard>

          <GlassCard className="p-5">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Indexes ({indexes.length})</h3>
              <GlassButton onClick={load} className="btn-secondary">Refresh</GlassButton>
            </div>
            {loading ? (
              <Skeleton className="h-20" />
            ) : indexes.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
                No full-text indexes yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {indexes.map((idx) => (
                  <div
                    key={idx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--vt-border, rgba(255,255,255,0.08))',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{idx.name}</span>
                        <Chip tone="cyan">{idx.language}</Chip>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                        {idx.tableName} · [{idx.columns.join(', ')}]
                      </div>
                    </div>
                    <GlassButton
                      onClick={() => handleDeleteIndex(idx)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--spectrum-coral, #f87171)' }}
                    >
                      Drop
                    </GlassButton>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Search panel */}
        <GlassCard className="p-5">
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Search</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Table</label>
              <GlassInput
                type="text"
                value={searchTable}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTable(e.target.value)}
                placeholder="articles"
                maxLength={64}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Query</label>
              <GlassInput
                type="text"
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  placeholder="climate migration"
                maxLength={1000}
              />
              <div style={{ fontSize: '10px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px', fontFamily: 'monospace' }}>
                match: space=AND, OR, "phrases", -exclude · plain: natural language
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Mode</label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as 'match' | 'plain')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--vt-border, rgba(255,255,255,0.1))',
                    color: 'var(--vt-text, #fff)',
                    fontSize: '13px',
                  }}
                >
                  <option value="match">Boolean (match)</option>
                  <option value="plain">Natural language (plain)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Limit</label>
                <GlassInput
                  type="number"
                  value={searchLimit}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchLimit(e.target.value)}
                  placeholder="20"
                  min="1"
                  max="100"
                />
              </div>
            </div>
            <GradientButton type="submit" disabled={searching || !searchTable.trim() || !searchQuery.trim()} className="w-full">
              {searching ? 'Searching…' : 'Search'}
            </GradientButton>
          </form>

          {searchError && <div style={{ marginTop: '12px' }}><Banner tone="error">{searchError}</Banner></div>}

          {searchResults.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginBottom: '8px' }}>
                {searchResults.length} results
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--vt-border, rgba(255,255,255,0.05))',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Chip tone="green">rank {r.rank.toFixed(4)}</Chip>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)' }}>
                        {Object.entries(r.row).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`).join(' · ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

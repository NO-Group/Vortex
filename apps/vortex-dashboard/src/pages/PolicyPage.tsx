import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ApiError } from '../lib/api.js';
import { GlassCard, GlassButton, PageTitle, Chip, Banner } from '../components/Glass.js';

/** Mirrors the core PolicyNode type without pulling the shared package in. */
type PolicyNode =
  | { column: string; op?: string; value?: unknown; valueRef?: string }
  | { and?: PolicyNode[]; or?: PolicyNode[]; not?: PolicyNode };

interface VortexPolicy {
  id: string;
  name: string;
  tableName: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  roles: string[];
  using: PolicyNode;
  withCheck: PolicyNode | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Preview {
  table: string;
  action: string;
  role: string;
  matchedPolicies: number;
  using: { sql: string; bindings: unknown[] } | null;
  withCheck: { sql: string; bindings: unknown[] } | null;
  notes: string[];
  comparison?: {
    vortex: string | null;
    perRowEquivalent: string;
    whyItMatters: string;
  };
}

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'contains'] as const;

const blankPolicy = (): Omit<VortexPolicy, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  tableName: '',
  action: 'select',
  roles: ['user'],
  using: { column: 'owner_id', valueRef: 'user.id' },
  withCheck: null,
  enabled: true,
});

const actionTone: Record<VortexPolicy['action'], 'default' | 'cyan' | 'green' | 'coral' | 'blue'> = {
  select: 'cyan',
  insert: 'green',
  update: 'blue',
  delete: 'coral',
};

/**
 * Policy Engine — row policies as data, compiled to a single bound
 * predicate rather than per-row function calls.
 *
 * The point of this page is the preview panel: it shows the SQL your policy
 * produces and what the per-row equivalent would look like (the Supabase
 * footgun), so you can see the difference without reading source.
 */
export function PolicyPage({ isAdmin }: { isAdmin: boolean }) {
  const [policies, setPolicies] = useState<VortexPolicy[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState(blankPolicy);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewRole, setPreviewRole] = useState('user');
  const [previewTable, setPreviewTable] = useState('');
  const [previewAction, setPreviewAction] = useState<VortexPolicy['action']>('select');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policiesRes, tablesRes] = await Promise.all([
        api.get<{ policies: VortexPolicy[] }>('/v1/policies'),
        api.get<{ tables: Array<{ name: string }> }>('/v1/db/tables'),
      ]);
      setPolicies(policiesRes.policies ?? []);
      setTables((tablesRes.tables ?? []).map((t) => t.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshPreview = useCallback(async () => {
    if (!previewTable) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await api.post<Preview>('/v1/policies/preview', {
        tableName: previewTable,
        action: previewAction,
        role: previewRole,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, [previewTable, previewAction, previewRole]);

  useEffect(() => {
    if (!previewTable && tables.length) {
      const systemTables = ['vortex_policies', 'vortex_query_log', 'users', 'table_permissions', 'storage_objects', 'apps', 'app_files', 'auth_tokens', 'buckets', 'functions'];
      const first = tables.find((t) => !systemTables.includes(t)) ?? tables[0];
      if (first) setPreviewTable(first);
    }
  }, [tables, previewTable]);

  useEffect(() => {
    if (previewTable) void refreshPreview();
  }, [refreshPreview, previewTable, previewAction, previewRole]);

  const resetForm = () => {
    setForm(blankPolicy());
    setEditing(null);
    setError(null);
  };

  const startEdit = (policy: VortexPolicy) => {
    setEditing(policy.id);
    setForm({
      name: policy.name,
      tableName: policy.tableName,
      action: policy.action,
      roles: policy.roles,
      using: policy.using,
      withCheck: policy.withCheck,
      enabled: policy.enabled,
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.tableName.trim()) {
      setError('Policy name and table are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, name: form.name.trim(), tableName: form.tableName.trim() };
      if (editing) {
        await api.patch<{ policy: VortexPolicy }>(`/v1/policies/${editing}`, {
          name: body.name,
          action: body.action,
          roles: body.roles,
          using: body.using,
          withCheck: body.withCheck,
          enabled: body.enabled,
        });
        setNotice('Policy updated');
      } else {
        await api.post<{ policy: VortexPolicy }>('/v1/policies', body);
        setNotice('Policy created');
      }
      resetForm();
      await load();
      void refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this policy?')) return;
    try {
      await api.del(`/v1/policies/${id}`);
      setNotice('Policy deleted');
      await load();
      void refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const policiesByTable = useMemo(() => {
    const map = new Map<string, VortexPolicy[]>();
    for (const policy of policies) {
      const list = map.get(policy.tableName) ?? [];
      list.push(policy);
      map.set(policy.tableName, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [policies]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Policy Engine" accent="Engine" subtitle="/v1/policies — admin only" />
        <Banner tone="info">
          Policy management requires the admin role.
        </Banner>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Policy Engine"
        accent="Engine"
        subtitle="/v1/policies — row policies compiled to a bound predicate, never a per-row function call"
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* ── Preview panel: the visible proof ────────────────────────── */}
      <GlassCard className="rounded-[18px] p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-white">Policy Preview</h2>
          <span className="ml-auto text-[10px] font-mono text-slate-500">
            compiled once · bound as a parameter
          </span>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Table</span>
            <select
              value={previewTable}
              onChange={(e) => setPreviewTable(e.target.value)}
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            >
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action</span>
            <select
              value={previewAction}
              onChange={(e) => setPreviewAction(e.target.value as VortexPolicy['action'])}
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="select">select</option>
              <option value="insert">insert</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role</span>
            <select
              value={previewRole}
              onChange={(e) => setPreviewRole(e.target.value)}
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="*">* (wildcard)</option>
            </select>
          </label>
          <div className="flex items-end">
            <GlassButton onClick={() => void refreshPreview()} className="w-full">
              {previewLoading ? 'Compiling…' : 'Compile'}
            </GlassButton>
          </div>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="cyan">
                matched {preview.matchedPolicies} {preview.matchedPolicies === 1 ? 'policy' : 'policies'}
              </Chip>
              {preview.using ? (
                <Chip tone="green">using predicate attached</Chip>
              ) : (
                <Chip tone="default">no policy for this role/action</Chip>
              )}
            </div>

            {preview.using && (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Vortex — compiled once
                </div>
                <pre className="rounded-xl border border-spectrum-green/20 bg-spectrum-green/[0.04] p-4 font-mono text-[13px] text-spectrum-green">
                  {preview.comparison?.vortex ?? preview.using.sql}
                </pre>
                <div className="mt-2 font-mono text-[11px] text-slate-400">
                  bindings: {JSON.stringify(preview.using.bindings)}
                </div>
              </div>
            )}

            {preview.comparison && (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Per-row equivalent (the footgun)
                </div>
                <pre className="rounded-xl border border-spectrum-coral/20 bg-spectrum-coral/[0.04] p-4 font-mono text-[13px] text-spectrum-coral">
                  {preview.comparison.perRowEquivalent}
                </pre>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                  {preview.comparison.whyItMatters}
                </p>
              </div>
            )}

            {preview.notes.map((note) => (
              <p key={note} className="text-[11px] leading-relaxed text-slate-500">
                {note}
              </p>
            ))}
          </div>
        )}

        {!preview && !previewLoading && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center text-[13px] text-slate-500">
            Pick a table and action to see the SQL your policies produce.
          </div>
        )}
      </GlassCard>

      {/* ── Existing policies ──────────────────────────────────────── */}
      <GlassCard className="rounded-[18px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-white">
            Policies on {policies.length > 0 ? `${policiesByTable.length} tables` : 'your schema'}
          </h2>
          <span className="text-[10px] font-mono text-slate-500">{policies.length} total</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
          </div>
        ) : policies.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
            <p className="text-[13px] text-slate-400">
              No policies yet. Create one below to see how identity is bound.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {policiesByTable.map(([table, list]) => (
              <div key={table}>
                <div className="mb-2 font-mono text-[11px] font-semibold text-slate-500">
                  {table}
                </div>
                <div className="space-y-2">
                  {list.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-white">{policy.name}</span>
                          <Chip tone={actionTone[policy.action]}>{policy.action}</Chip>
                          <span className="font-mono text-[10px] text-slate-500">
                            {policy.roles.join(', ')}
                          </span>
                          {!policy.enabled && <Chip tone="default">disabled</Chip>}
                        </div>
                        <pre className="mt-1 font-mono text-[11px] leading-relaxed text-slate-500">
                          {JSON.stringify(policy.using)}
                        </pre>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <GlassButton
                          onClick={() => startEdit(policy)}
                          className="px-2 py-1 text-[11px]"
                        >
                          edit
                        </GlassButton>
                        <GlassButton
                          onClick={() => void remove(policy.id)}
                          className="px-2 py-1 text-[11px]"
                        >
                          delete
                        </GlassButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ── Create / edit ─────────────────────────────────────────── */}
      <GlassCard className="rounded-[18px] p-6">
        <h2 className="mb-5 text-sm font-semibold tracking-wide text-white">
          {editing ? 'Edit policy' : 'Create policy'}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Name
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="reports are private"
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Table
            </span>
            <input
              type="text"
              value={form.tableName}
              onChange={(e) => setForm({ ...form, tableName: e.target.value })}
              placeholder="reports"
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Action
            </span>
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value as VortexPolicy['action'] })}
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="select">select</option>
              <option value="insert">insert</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Roles
            </span>
            <input
              type="text"
              value={form.roles.join(', ')}
              onChange={(e) =>
                setForm({
                  ...form,
                  roles: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="user, editor"
              className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            USING predicate (JSON)
          </span>
          <textarea
            value={JSON.stringify(form.using, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value) as PolicyNode;
                setForm({ ...form, using: parsed });
              } catch {
                // Keep typing; don't clobber the form on partial JSON.
              }
            }}
            rows={5}
            className="input-vortex w-full rounded-lg px-3 py-2 font-mono text-[12px] text-white"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            Use <code className="font-mono">valueRef: 'user.id'</code> to bind the caller's identity —
            it's resolved once and passed as a query parameter.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <GlassButton
            onClick={() => void save()}
            disabled={saving}
            className="px-5 py-2"
          >
            {saving ? 'Saving…' : editing ? 'Update policy' : 'Create policy'}
          </GlassButton>
          {editing && (
            <GlassButton onClick={resetForm} className="px-4 py-2">
              Cancel
            </GlassButton>
          )}
        </div>
      </GlassCard>

      <div className="flex flex-wrap gap-1.5">
        {OPS.map((op) => (
          <span
            key={op}
            className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-slate-500"
          >
            {op}
          </span>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, type CronJob, type CronRun } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassButton,
  GlassCard,
  GlassInput,
  GradientButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';
import { formatDateTime } from '../lib/format.js';

const STATUS_TONES: Record<string, 'default' | 'cyan' | 'green' | 'coral' | 'blue'> = {
  enabled: 'green',
  disabled: 'coral',
  success: 'green',
  error: 'coral',
  timeout: 'blue',
  pending: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  success: 'Success',
  error: 'Error',
  timeout: 'Timeout',
  pending: 'Pending',
};

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runsByJob, setRunsByJob] = useState<Record<string, CronRun[]>>({});

  // Create form
  const [name, setName] = useState('');
  const [functionName, setFunctionName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [payloadText, setPayloadText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ jobs: CronJob[] }>('/v1/cron/jobs');
      setJobs(res.jobs);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !cronExpression.trim()) return;
    setBusy(true);
    try {
      const payload = payloadText.trim() ? JSON.parse(payloadText) : undefined;
      await api.post('/v1/cron/jobs', {
        name: name.trim(),
        functionName: functionName.trim() || null,
        cronExpression: cronExpression.trim(),
        payload,
      });
      setName('');
      setFunctionName('');
      setCronExpression('');
      setPayloadText('');
      setNotice('Scheduled job created.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create cron job');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (job: CronJob, newStatus: 'enabled' | 'disabled') => {
    try {
      await api.patch(`/v1/cron/jobs/${job.name}`, { status: newStatus });
      setNotice(`Job "${job.name}" ${newStatus === 'enabled' ? 'enabled' : 'disabled'}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update job');
    }
  };

  const handleTrigger = async (job: CronJob) => {
    try {
      const res = await api.post<{ job: CronJob; result: Record<string, unknown> | null }>(
        `/v1/cron/jobs/${job.name}/trigger`,
        {},
      );
      setNotice(`Job "${job.name}" triggered successfully.`);
      setExpandedJob(job.name);
      await loadRuns(job.name);
      await load();
      void res;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to trigger job');
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/v1/cron/jobs/${job.name}`);
      setNotice(`Job "${job.name}" deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete job');
    }
  };

  const loadRuns = async (jobName: string) => {
    try {
      const res = await api.get<{ runs: CronRun[] }>(`/v1/cron/jobs/${jobName}/runs`);
      setRunsByJob((prev) => ({ ...prev, [jobName]: res.runs }));
    } catch {
      // Non-fatal — runs are secondary
    }
  };

  const handleExpand = async (jobName: string) => {
    if (expandedJob === jobName) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobName);
    await loadRuns(jobName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageTitle
        title="Scheduled Jobs"
        accent=""
        subtitle="Autonomous cron-triggered execution of Vortex Functions. Schedule cleanups, reports, syncs — no server needed."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Create form */}
        <GlassCard className="p-5">
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Create Scheduled Job</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Job Name</label>
              <GlassInput
                type="text"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="daily-cleanup"
                maxLength={40}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Function Name</label>
              <GlassInput
                type="text"
                value={functionName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFunctionName(e.target.value)}
                placeholder="cleanup-task (leave empty for none)"
                maxLength={40}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Cron Expression</label>
              <GlassInput
                type="text"
                value={cronExpression}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCronExpression(e.target.value)}
                placeholder="0 * * * * (every hour)"
                maxLength={100}
              />
              <div style={{ fontSize: '10px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px', fontFamily: 'monospace' }}>
                format: min hour day month weekday
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Payload (JSON, optional)</label>
              <GlassInput
                type="text"
                value={payloadText}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPayloadText(e.target.value)}
                placeholder='{"limit": 100}'
              />
            </div>
            <GradientButton type="submit" disabled={busy || !name.trim() || !cronExpression.trim()} className="w-full">
              {busy ? 'Creating…' : 'Create Job'}
            </GradientButton>
          </form>
        </GlassCard>

        {/* Jobs list */}
        <GlassCard className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Jobs ({jobs.length})</h3>
            <GlassButton onClick={load} className="btn-secondary">Refresh</GlassButton>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : jobs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
              No scheduled jobs yet. Create one to automate your functions.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.map((job) => (
                <div key={job.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--vt-border, rgba(255,255,255,0.08))',
                    }}
                  >
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => handleExpand(job.name)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{job.name}</span>
                        <Chip tone={STATUS_TONES[job.status] ?? 'default'}>
                          {STATUS_LABELS[job.status]}
                        </Chip>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                        <span style={{ fontFamily: 'monospace' }}>{job.cronExpression}</span>
                        {job.functionName && ` → ${job.functionName}`}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                        {job.nextRunAt ? `Next: ${formatDateTime(job.nextRunAt)}` : 'No next run'}
                        {job.lastRunAt && ` · Last: ${formatDateTime(job.lastRunAt)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {job.status === 'enabled' ? (
                        <GlassButton onClick={() => handleToggle(job, 'disabled')} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                          Pause
                        </GlassButton>
                      ) : (
                        <GlassButton onClick={() => handleToggle(job, 'enabled')} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                          Enable
                        </GlassButton>
                      )}
                      <GlassButton onClick={() => handleTrigger(job)} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                        Trigger
                      </GlassButton>
                      <GlassButton
                        onClick={() => handleDelete(job)}
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--spectrum-coral, #f87171)' }}
                      >
                        Delete
                      </GlassButton>
                    </div>
                  </div>

                  {/* Execution history */}
                  {expandedJob === job.name && (
                    <div style={{ marginTop: '8px', marginLeft: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginBottom: '8px' }}>
                        Execution History
                      </div>
                      {runsByJob[job.name]?.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)' }}>
                          No runs yet. Trigger the job to see execution history.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {runsByJob[job.name]?.map((run) => (
                            <div
                              key={run.id}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--vt-border, rgba(255,255,255,0.05))',
                                fontSize: '11px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Chip tone={STATUS_TONES[run.status] ?? 'default'}>
                                  {STATUS_LABELS[run.status]}
                                </Chip>
                                <span style={{ color: 'var(--vt-text-dim, #9ca3af)' }}>{formatDateTime(run.startedAt)}</span>
                                {run.durationMs != null && (
                                  <span style={{ color: 'var(--vt-text-dim, #9ca3af)' }}>{run.durationMs}ms</span>
                                )}
                              </div>
                              {run.errorMessage && (
                                <div style={{ color: 'var(--spectrum-coral, #f87171)', marginTop: '4px' }}>
                                  {run.errorMessage}
                                </div>
                              )}
                              {run.result && (
                                <div style={{ color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px', fontFamily: 'monospace' }}>
                                  {JSON.stringify(run.result).slice(0, 200)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { GlassCard, PageTitle } from '../components/Glass.js';

interface SecurityCheck {
  name: string;
  passed: boolean;
  weight: number;
  detail: string;
}

interface SecurityScore {
  score: number;
  grade: string;
  checks: SecurityCheck[];
  recommendations: string[];
}

interface EncryptionInfo {
  algorithm: string;
  keyVersion: string;
  atRest: boolean;
  fields: string[];
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#10b981', 'A': '#10b981', 'B': '#8b5cf6',
  'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
};

export function SecurityPage() {
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [encryption, setEncryption] = useState<EncryptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vortex_token');
      const res = await fetch('/v1/security/score', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setScore(await res.json());
      const enc = await fetch('/v1/security/encryption');
      if (enc.ok) setEncryption(await enc.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const passedChecks = score?.checks.filter(c => c.passed).length ?? 0;
  const totalChecks = score?.checks.length ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle title="Security Posture" subtitle="Real-time security scoring and encryption status" />

      {loading ? (
        <GlassCard><div className="p-8 text-center text-gray-500">Loading security posture…</div></GlassCard>
      ) : !score ? (
        <GlassCard><div className="p-8 text-center text-gray-500">No security data available</div></GlassCard>
      ) : (
        <>
          {/* Score Header */}
          <GlassCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
                  style={{ background: `${GRADE_COLORS[score.grade] ?? '#6366f1'}22`, color: GRADE_COLORS[score.grade] ?? '#6366f1' }}
                >
                  {score.grade}
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">{score.score}<span className="text-lg text-gray-500">/100</span></div>
                  <div className="text-sm text-gray-400 mt-1">{passedChecks} of {totalChecks} checks passed</div>
                </div>
              </div>
              <button
                onClick={fetchData}
                className="px-4 py-2 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 transition"
              >
                Refresh
              </button>
            </div>
          </GlassCard>

          {/* Checks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {score.checks.map((check) => (
              <GlassCard key={check.name}>
                <div className="flex items-center gap-2 mb-1">
                  {check.passed ? (
                    <span className="text-green-400">✓ Passed</span>
                  ) : (
                    <span className="text-red-400">✗ Failed</span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">Weight: {check.weight}</span>
                </div>
                <div className="text-sm font-semibold text-white">{check.name}</div>
                <p className="text-xs text-gray-400 mt-1">{check.detail}</p>
              </GlassCard>
            ))}
          </div>

          {/* Recommendations */}
          {score.recommendations.length > 0 && (
            <GlassCard>
              <h3 className="text-lg font-semibold text-white mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {score.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {/* Encryption Info */}
          {encryption && (
            <GlassCard>
              <h3 className="text-lg font-semibold text-white mb-3">Encryption at Rest</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Algorithm</div>
                  <div className="text-sm text-white font-mono">{encryption.algorithm}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Key Version</div>
                  <div className="text-sm text-white font-mono">{encryption.keyVersion}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`text-sm font-semibold ${encryption.atRest ? 'text-green-400' : 'text-red-400'}`}>
                    {encryption.atRest ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Encrypted Fields</div>
                  <div className="text-sm text-gray-300">{encryption.fields.length} fields</div>
                </div>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

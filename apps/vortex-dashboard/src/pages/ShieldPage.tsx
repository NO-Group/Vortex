import { useState, useCallback } from 'react';
import { api } from '../lib/api.js';

interface Attestation {
  id: string;
  attestationType: string;
  valid: boolean;
  revision: string | null;
  createdAt: string;
}

export function ShieldPage() {
  const [attestationType, setAttestationType] = useState('app_check');
  const [payload, setPayload] = useState('{}');
  const [result, setResult] = useState<string>('');
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [throttle, setThrottle] = useState<{ ip: string; remaining: number; limited: boolean } | null>(null);
  const [sigMethod, setSigMethod] = useState('POST');
  const [sigPath, setSigPath] = useState('/v1/shield/health');
  const [sigBody, setSigBody] = useState('');
  const [sigResult, setSigResult] = useState('');

  const verifyAttestation = useCallback(async () => {
    try {
      const parsed = JSON.parse(payload);
      const res = await api.post<{ valid: boolean }>('/v1/shield/attest', { attestationType, payload: parsed });
      setResult(`✓ Attestation valid: ${res.valid}`);
      loadAttestations();
    } catch (e) {
      setResult(`✗ ${(e as Error).message}`);
    }
  }, [api, attestationType, payload]);

  const loadAttestations = useCallback(async () => {
    try {
      const res = await api.get<{ attestations: Attestation[] }>('/v1/shield/attestations');
      setAttestations(res.attestations);
    } catch { /* ignore */ }
  }, [api]);

  const checkThrottle = useCallback(async () => {
    try {
      const res = await api.get<{ ip: string; remaining: number; limited: boolean }>('/v1/shield/throttle');
      setThrottle(res);
    } catch (e) {
      setResult(`✗ ${(e as Error).message}`);
    }
  }, [api]);

  const verifySignature = useCallback(async () => {
    try {
      const ts = Date.now();
      const res = await api.post<{ signature: string; timestamp: number }>('/v1/shield/signature/generate', { method: sigMethod, path: sigPath, body: sigBody, timestamp: ts });
      setSigResult(`Signature: ${res.signature}\nTimestamp: ${res.timestamp}`);
    } catch (e) {
      setSigResult(`✗ ${(e as Error).message}`);
    }
  }, [api, sigMethod, sigPath, sigBody]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Shield</h1>
        <p className="text-sm text-slate-400">Client attestation, IP throttling, and request signature verification</p>
      </div>

      {/* Attestation */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Client Attestation</h2>
        <p className="text-xs text-slate-500">Verify AppCheck / Play Integrity / SafetyNet attestation payloads</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400">Type</label>
            <select
              value={attestationType}
              onChange={(e) => setAttestationType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="app_check">App Check</option>
              <option value="play_integrity">Play Integrity</option>
              <option value="safety_net">SafetyNet</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-400">Payload (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-300"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={verifyAttestation}
            className="rounded-lg bg-spectrum-cyan/20 px-4 py-2 text-sm font-medium text-spectrum-cyan transition hover:bg-spectrum-cyan/30"
          >
            Verify Attestation
          </button>
          <button
            onClick={checkThrottle}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20"
          >
            Check Throttle
          </button>
        </div>
        {result && <p className="mt-2 font-mono text-xs text-slate-400">{result}</p>}
        {throttle && (
          <div className="mt-2 rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <p className="font-mono text-xs text-slate-400">
              IP: {throttle.ip} · Remaining: {throttle.remaining} · Limited: {throttle.limited ? 'yes' : 'no'}
            </p>
          </div>
        )}
      </div>

      {/* Signature */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Request Signature</h2>
        <p className="text-xs text-slate-500">Generate HMAC-SHA256/512 signatures for API request signing</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400">Method</label>
            <select value={sigMethod} onChange={(e) => setSigMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
              <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-400">Path</label>
            <input value={sigPath} onChange={(e) => setSigPath(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-400">Body</label>
            <textarea value={sigBody} onChange={(e) => setSigBody(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-300" />
          </div>
        </div>
        <button onClick={verifySignature} className="mt-3 rounded-lg bg-spectrum-cyan/20 px-4 py-2 text-sm font-medium text-spectrum-cyan transition hover:bg-spectrum-cyan/30">
          Generate Signature
        </button>
        {sigResult && <p className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-400">{sigResult}</p>}
      </div>

      {/* Attestations list */}
      {attestations.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Attestations</h2>
            <button onClick={loadAttestations} className="text-xs text-spectrum-cyan hover:underline">Refresh</button>
          </div>
          <div className="mt-3 space-y-2">
            {attestations.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                <div>
                  <span className="text-sm text-white">{a.attestationType}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{a.createdAt}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${a.valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {a.valid ? 'valid' : 'invalid'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

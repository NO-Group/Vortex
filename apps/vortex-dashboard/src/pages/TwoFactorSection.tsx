import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassButton,
  GlassCard,
  GlassInput,
  GradientButton,
} from '../components/Glass.js';

export function TwoFactorSection() {
  const [status, setStatus] = useState<'loading' | 'disabled' | 'enabled'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Setup state
  const [setupData, setSetupData] = useState<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [setupCode, setSetupCode] = useState('');

  // Disable state
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<{ user: { two_factor_enabled: boolean } }>('/v1/auth/me');
      setStatus(res.user.two_factor_enabled ? 'enabled' : 'disabled');
    } catch (e) {
      setStatus('disabled');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    setError('');
    setNotice('');
    try {
      const res = await api.post<{
        secret: string;
        otpauthUrl: string;
        backupCodes: string[];
      }>('/v1/auth/2fa/setup', {});
      setSetupData(res);
      setNotice('Scan the QR code or enter the secret in your authenticator app.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to begin 2FA setup');
    }
  };

  const handleEnable = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await api.post('/v1/auth/2fa/enable', { code: setupCode });
      setSetupData(null);
      setSetupCode('');
      setNotice('Two-factor authentication enabled!');
      await loadStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code');
    }
  };

  const handleDisable = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await api.post('/v1/auth/2fa/disable', {
        password: disablePassword,
        code: disableCode,
      });
      setDisablePassword('');
      setDisableCode('');
      setNotice('Two-factor authentication disabled.');
      await loadStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disable 2FA');
    }
  };

  const handleRegenerateBackup = async () => {
    setError('');
    setNotice('');
    try {
      const res = await api.post<{ backupCodes: string[] }>(
        '/v1/auth/2fa/backup-codes',
        {},
      );
      setNotice('New backup codes generated. Store them securely.');
      // Show the new codes
      alert('New backup codes:\n' + res.backupCodes.join('\n'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to regenerate backup codes');
    }
  };

  const handleCopySecret = () => {
    if (!setupData) return;
    navigator.clipboard?.writeText(setupData.secret);
    setNotice('Secret copied to clipboard.');
  };

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Two-Factor Authentication</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)' }}>
            Add an extra layer of security to your account.
          </p>
        </div>
        <Chip tone={status === 'enabled' ? 'green' : 'default'}>
          {status === 'enabled' ? 'Enabled' : status === 'loading' ? '…' : 'Disabled'}
        </Chip>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* Setup flow */}
      {setupData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
              Authenticator App
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <a
                href={setupData.otpauthUrl}
                className="font-mono text-xs text-blue-400 hover:text-blue-300"
                style={{ wordBreak: 'break-all' }}
              >
                {setupData.otpauthUrl}
              </a>
              <GlassButton onClick={handleCopySecret} className="btn-secondary">
                Copy Secret
              </GlassButton>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)' }}>
              Click the link to open in your authenticator app, or manually enter the secret.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
              Backup Codes
            </label>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', wordBreak: 'break-all' }}>
              {setupData.backupCodes.join('  ')}
            </div>
          </div>

          <form onSubmit={handleEnable} style={{ display: 'flex', gap: '8px' }}>
            <GlassInput
              type="text"
              value={setupCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSetupCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              style={{ maxWidth: '140px' }}
            />
            <GradientButton type="submit">Confirm Enable</GradientButton>
          </form>
        </div>
      )}

      {/* Disabled state */}
      {status === 'disabled' && !setupData && (
        <GlassButton onClick={handleSetup} className="btn-secondary">
          Enable 2FA
        </GlassButton>
      )}

      {/* Enabled state */}
      {status === 'enabled' && !setupData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginBottom: '6px' }}>
              Backup codes (store securely — each can be used once):
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)' }}>
              Stored securely on the server. Use an authenticator app for login codes.
            </div>
          </div>

          <GlassButton onClick={handleRegenerateBackup} className="btn-secondary">
            Regenerate Backup Codes
          </GlassButton>

          <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <GlassInput
                type="password"
                value={disablePassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDisablePassword(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                2FA Code
              </label>
              <GlassInput
                type="text"
                value={disableCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDisableCode(e.target.value)}
                placeholder="6-digit code or backup code"
                maxLength={10}
              />
            </div>
            <GlassButton type="submit" className="btn-secondary" style={{ color: 'var(--spectrum-coral, #f87171)' }}>
              Disable 2FA
            </GlassButton>
          </form>
        </div>
      )}
    </GlassCard>
  );
}

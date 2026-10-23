import { useState, type FormEvent } from 'react';
import { api, type AuthSession } from '../lib/api.js';
import { Banner, GlassButton, GradientButton } from '../components/Glass.js';

export function Login({
  onLogin,
  notice,
}: {
  onLogin: (session: AuthSession) => void;
  notice?: string | null;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicToken, setMagicToken] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session =
        mode === 'login'
          ? await api.post<AuthSession>('/v1/auth/login', { email, password })
          : await api.post<AuthSession>('/v1/auth/signup', { email, password });
      if (!session?.token || !session?.user) {
        setError('Unexpected server response — please try again');
        return;
      }
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setEmail('sensei@no.group');
    setPassword('vortex-secret-1');
    setMode('login');
  };

  /** Passwordless sign-in: request a one-time link for the email. */
  const sendMagicLink = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then request a sign-in link');
      return;
    }
    setBusy(true);
    setError(null);
    setMagicToken(null);
    try {
      const res = await api.post<{ ok: true; devToken?: string }>('/v1/auth/magic-link', {
        email: email.trim(),
      });
      if (res.devToken) {
        setMagicToken(res.devToken);
      } else {
        setError(null);
        alert('If that account exists, a sign-in link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link');
    } finally {
      setBusy(false);
    }
  };

  const useMagicLink = async () => {
    if (!magicToken) return;
    setBusy(true);
    try {
      const session = await api.post<AuthSession>('/v1/auth/magic-link/verify', {
        token: magicToken,
      });
      if (session?.token) onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link is invalid or expired');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] animate-fade-in">
        <div className="glass-strong p-8">
          <div className="flex flex-col items-center">
            <div className="gradient-ring h-28 w-28 rounded-[32px]">
              <div className="flex h-full w-full items-center justify-center rounded-[30.5px]">
                <img src="/logo.png" alt="Vortex" className="h-[72px] w-[72px] object-contain" />
              </div>
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-[0.12em] text-white">
              VORTEX <span className="gradient-text">CONSOLE</span>
            </h1>
            <p className="mt-1.5 text-center text-sm text-slate-400">
              N.O Group · high-performance BaaS engine
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {notice && <Banner tone="info">{notice}</Banner>}
            {error && <Banner tone="error">{error}</Banner>}

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-400">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@no.group"
                className="input-vortex w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-400">
                Password
              </label>
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-vortex w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <GradientButton type="submit" disabled={busy} className="w-full py-3">
              {busy
                ? 'Connecting…'
                : mode === 'login'
                  ? 'Enter the Engine'
                  : 'Create Account'}
            </GradientButton>
          </form>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="text-[12px] text-slate-400 transition hover:text-spectrum-cyan"
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
            </button>
            <GlassButton onClick={useDemo} className="px-3 py-1.5 text-[11px]">
              Use demo account
            </GlassButton>
          </div>

          <div className="mt-4 border-t border-white/[0.07] pt-4">
            {magicToken ? (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400">
                  Sign-in link ready (dev mode delivers it inline).
                </div>
                <GradientButton
                  onClick={() => void useMagicLink()}
                  disabled={busy}
                  className="w-full py-2.5 text-[12px]"
                >
                  Open sign-in link →
                </GradientButton>
              </div>
            ) : (
              <button
                onClick={() => void sendMagicLink()}
                disabled={busy}
                className="w-full text-[12px] text-slate-400 transition hover:text-spectrum-mint"
              >
                ✉ Email me a sign-in link instead
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-widest text-slate-600">
          A M O S P H E R E · B Y · N . O · G R O U P
        </p>
      </div>
    </div>
  );
}

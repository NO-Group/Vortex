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
        </div>

        <p className="mt-6 text-center text-[11px] tracking-widest text-slate-600">
          A M O S P H E R E · B Y · N . O · G R O U P
        </p>
      </div>
    </div>
  );
}

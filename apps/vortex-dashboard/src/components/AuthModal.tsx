import { useState } from 'react';
import { api, type AuthUser } from '../api';

/**
 * Vortex — Auth Modal.
 *
 * The glassmorphic auth panel that slides in when the user clicks
 * "Sign In" or "Sign Up" anywhere on the landing page.
 * Implements the N.O Group design system with full interactivity.
 */

type Mode = 'login' | 'signup';

export function AuthModal({
  open,
  onClose,
  onAuthSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  if (!open) return null;

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await api.signup(form.email, form.password, form.name);
        onAuthSuccess(res.user);
      } else {
        const res = await api.login(form.email, form.password);
        onAuthSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative w-full max-w-md p-8 sm:p-10 shadow-2xl shadow-black/80 animate-slide-up"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          ✕
        </button>

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <VortexLogo />
          <h2 className="mt-3 text-xl font-bold">
            {mode === 'login' ? (
              <>Welcome back</>
            ) : (
              <>Create your account</>
            )}
          </h2>
          <p className="mt-1 text-sm text-white/40">
            {mode === 'login' ? 'Sign in to your Vortex console' : 'Start building with Vortex'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex gap-1 rounded-xl bg-black/40 p-1 border border-white/[0.06]">
          <ModeToggle
            active={mode === 'login'}
            onClick={() => { setMode('login'); setError(null); }}
            label="Sign In"
          />
          <ModeToggle
            active={mode === 'signup'}
            onClick={() => { setMode('signup'); setError(null); }}
            label="Sign Up"
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Field
              label="Full Name"
              type="text"
              name="name"
              placeholder="Ada Lovelace"
              value={form.name}
              onChange={(v) => update('name', v)}
            />
          )}
          <Field
            label="Email"
            type="email"
            name="email"
            placeholder="you@vortex.io"
            value={form.email}
            onChange={(v) => update('email', v)}
          />
          <Field
            label="Password"
            type="password"
            name="password"
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
            value={form.password}
            onChange={(v) => update('password', v)}
          />

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 animate-fade-in">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Spinner />
                {mode === 'login' ? 'Authenticating…' : 'Creating account…'}
              </>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-xs text-white/25">or</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* OAuth */}
        <div className="grid grid-cols-2 gap-3">
          <OAuthButton label="Google" icon="G" />
          <OAuthButton label="GitHub" icon="⌘" />
        </div>

        <p className="mt-5 text-center text-xs text-white/25">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); }} className="font-medium text-focus hover:text-cyber">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(null); }} className="font-medium text-focus hover:text-cyber">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function VortexLogo() {
  return (
    <svg className="vortex-logo h-14 w-14 animate-vortex-spin" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="auth-logo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#004BFF" />
          <stop offset="40%" stopColor="#A38CFF" />
          <stop offset="70%" stopColor="#00D2FF" />
          <stop offset="100%" stopColor="#00E6A6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="42" stroke="url(#auth-logo)" strokeWidth="5" opacity="0.8" />
      <circle cx="50" cy="50" r="28" stroke="url(#auth-logo)" strokeWidth="4" opacity="0.5" />
      <circle cx="50" cy="50" r="14" stroke="url(#auth-logo)" strokeWidth="3" opacity="0.4" />
      <circle cx="50" cy="50" r="6" fill="url(#auth-logo)" />
    </svg>
  );
}

function ModeToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300
        ${active
          ? 'bg-gradient-to-r from-anchor/20 to-cyber/20 text-white border border-white/10 shadow-[0_0_20px_rgba(0,75,255,0.15)]'
          : 'text-white/40 hover:text-white/70 border border-transparent'
        }
      `}
    >
      {label}
    </button>
  );
}

function Field({
  label, type, name, placeholder, value, onChange,
}: {
  label: string; type: string; name: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium uppercase tracking-wider text-white/40">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full text-sm"
      />
    </div>
  );
}

function OAuthButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button type="button" className="btn-glass hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(51,121,255,0.1)]">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-xs font-bold">{icon}</span>
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white" />
    </svg>
  );
}

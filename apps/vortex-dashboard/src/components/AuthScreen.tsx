import { useState } from 'react';
import { api, type AuthUser } from '../api';

/**
 * Vortex Dashboard — Auth Screen (Login / Signup).
 *
 * Glassmorphic design implementing the N.O Group design system:
 *  - AMOLED pure black canvas with layered radial mesh gradients
 *  - Frosted glass panels with backdrop blur
 *  - 6-stop chromatic gradient accents
 *  - Animated Vortex logo, ambient glow orbs, shimmer effects
 */

type Mode = 'login' | 'signup';

export function AuthScreen({ onAuthSuccess }: { onAuthSuccess: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = formData;
      if (mode === 'signup') {
        const res = await api.signup(data.email, data.password, data.name);
        onAuthSuccess(res.user);
      } else {
        const res = await api.login(data.email, data.password);
        onAuthSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ── Ambient background layer ───────────────────────────────────────── */}
      <BackgroundGlow />

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-slide-up">
          {/* Logo + Brand */}
          <div className="mb-8 flex flex-col items-center text-center animate-fade-in">
            <VortexLogo />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              <span className="text-gradient">Vortex</span>
            </h1>
            <p className="mt-1.5 text-sm text-white/40">
              High-performance Backend-as-a-Service
            </p>
          </div>

          {/* Auth card — the centerpiece */}
          <div className="glass-strong p-8 sm:p-10 shadow-2xl shadow-black/50">
            {/* Mode toggle */}
            <div className="mb-8 flex gap-1 rounded-xl bg-black/40 p-1 border border-white/[0.06]">
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
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <Field
                  label="Full Name"
                  type="text"
                  name="name"
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(v) => updateField('name', v)}
                />
              )}

              <Field
                label="Email"
                type="email"
                name="email"
                placeholder="you@vortex.io"
                autoComplete="email"
                value={formData.email}
                onChange={(v) => updateField('email', v)}
              />

              <Field
                label="Password"
                type="password"
                name="password"
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={formData.password}
                onChange={(v) => updateField('password', v)}
              />

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 animate-fade-in">
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
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
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs text-white/25">or continue with</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            {/* OAuth buttons */}
            <div className="grid grid-cols-2 gap-3">
              <OAuthButton label="Google" icon="G" />
              <OAuthButton label="GitHub" icon="⌘" />
            </div>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-white/25">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(null); }}
                    className="font-medium text-focus transition-colors hover:text-cyber"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(null); }}
                    className="font-medium text-focus transition-colors hover:text-cyber"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-white/15">
            By continuing, you agree to Vortex's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Background Glow ──────────────────────────────────────────────────────── */

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Grid layer */}
      <div className="grid-bg absolute inset-0 opacity-60" />

      {/* Floating gradient orbs */}
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '400px',
          height: '400px',
          top: '-100px',
          left: '-100px',
          background: 'radial-gradient(circle, #004BFF 0%, transparent 70%)',
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '350px',
          height: '350px',
          bottom: '-80px',
          right: '-80px',
          background: 'radial-gradient(circle, #00D2FF 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '300px',
          height: '300px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, #A38CFF 0%, transparent 70%)',
          opacity: 0.08,
          animationDelay: '4s',
        }}
      />
    </div>
  );
}

/* ── Vortex Logo ──────────────────────────────────────────────────────────── */

function VortexLogo() {
  return (
    <svg
      className="vortex-logo h-16 w-16 animate-vortex-spin"
      viewBox="0 0 100 100"
      fill="none"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#004BFF" />
          <stop offset="40%" stopColor="#A38CFF" />
          <stop offset="70%" stopColor="#00D2FF" />
          <stop offset="100%" stopColor="#00E6A6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="42" stroke="url(#logo-grad)" strokeWidth="6" opacity="0.8" />
      <circle cx="50" cy="50" r="30" stroke="url(#logo-grad)" strokeWidth="4" opacity="0.5" />
      <circle cx="50" cy="50" r="18" stroke="url(#logo-grad)" strokeWidth="3" opacity="0.4" />
      <circle cx="50" cy="50" r="8" fill="url(#logo-grad)" />
    </svg>
  );
}

/* ── Mode Toggle ──────────────────────────────────────────────────────────── */

function ModeToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-all duration-300
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

/* ── Form Field ───────────────────────────────────────────────────────────── */

function Field({
  label,
  type,
  name,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  type: string;
  name: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full text-sm"
      />
    </div>
  );
}

/* ── OAuth Button ─────────────────────────────────────────────────────────── */

function OAuthButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
      className="btn-glass hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(51,121,255,0.1)]"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-xs font-bold">
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-white"
      />
    </svg>
  );
}

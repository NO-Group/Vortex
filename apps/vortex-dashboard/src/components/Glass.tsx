import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/** Frosted structural panel. */
export function GlassCard({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Primary kinetic CTA (spectrum gradient + refraction flare on hover). */
export function GradientButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn-kinetic px-5 py-2.5 text-sm ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Secondary glass button. */
export function GlassButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn-glass px-4 py-2 text-sm ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function StatusDot({ status }: { status: 'live' | 'warn' | 'off' }) {
  return <span className={`status-dot status-${status}`} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'cyan' | 'green' | 'coral' | 'blue' }) {
  const tones: Record<string, string> = {
    default: 'border-white/10 bg-white/5 text-slate-300',
    cyan: 'border-spectrum-cyan/30 bg-spectrum-cyan/10 text-spectrum-cyan',
    green: 'border-spectrum-green/30 bg-spectrum-green/10 text-spectrum-green',
    coral: 'border-spectrum-coral/30 bg-spectrum-coral/10 text-spectrum-coral',
    blue: 'border-spectrum-blue/40 bg-spectrum-blue/15 text-blue-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Section heading with gradient accent word. */
export function PageTitle({
  title,
  accent,
  subtitle,
}: {
  title: string;
  accent?: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {title}{' '}
        {accent && <span className="gradient-text">{accent}</span>}
      </h1>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

/** Error / info banner. */
export function Banner({ tone, children }: { tone: 'error' | 'info' | 'ok'; children: ReactNode }) {
  const tones: Record<string, string> = {
    error: 'border-spectrum-coral/40 bg-spectrum-coral/10 text-spectrum-coral',
    info: 'border-interactive-focus/40 bg-interactive-focus/10 text-blue-300',
    ok: 'border-spectrum-green/40 bg-spectrum-green/10 text-spectrum-green',
  };
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-sm ${tones[tone]}`} role="alert">
      {children}
    </div>
  );
}

/** Frosted text input. */
export function GlassInput({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-interactive-focus/60 focus:outline-none focus:ring-2 focus:ring-interactive-focus/20 ${className}`}
      {...rest}
    />
  );
}

/** Frosted textarea. */
export function GlassTextArea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-interactive-focus/60 focus:outline-none focus:ring-2 focus:ring-interactive-focus/20 ${className}`}
      {...rest}
    />
  );
}

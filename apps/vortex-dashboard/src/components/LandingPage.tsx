import { useState, useEffect } from 'react';
import { AuthModal } from './AuthModal';
import type { AuthSession } from '../lib/api';

/**
 * Vortex — Multi-page Landing Site.
 *
 * Hash-routed marketing site with separate pages:
 *   #/            Home
 *   #/features    Full feature showcase
 *   #/architecture How it works
 *   #/pricing     Five-tier pricing
 *   #/howto       How to use Vortex (complete guide)
 *   #/docs        Documentation
 *   #/legal       Privacy & Terms
 *
 * Sign In / Sign Up buttons appear throughout and open
 * the glassmorphic AuthModal overlay when clicked.
 */

type Page = 'home' | 'features' | 'architecture' | 'pricing' | 'howto' | 'docs' | 'legal';

const PAGE_IDS: Page[] = ['home', 'features', 'architecture', 'pricing', 'howto', 'docs', 'legal'];

function pageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '') as Page;
  return PAGE_IDS.includes(hash) ? hash : 'home';
}

export function LandingPage({ onAuthSuccess }: { onAuthSuccess: (session: AuthSession) => void }) {
  const [page, setPage] = useState<Page>(() => (typeof window !== 'undefined' ? pageFromHash() : 'home'));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  // Hash routing
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (id: Page) => {
    window.location.hash = `#/${id}`;
    setPage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Global ambient background ───────────────────────────────────────── */}
      <LandingBackground />

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <Navbar
        onNavigate={navigate}
        onSignIn={() => openAuth('login')}
        onSignUp={() => openAuth('signup')}
        activePage={page}
      />

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="relative z-10">
        {page === 'home' && (
          <>
            <Hero onSignUp={() => openAuth('signup')} onSignIn={() => openAuth('login')} onNavigate={navigate} />
            <HomeFeatures onNavigate={navigate} />
          </>
        )}
        {page === 'features' && <Features />}
        {page === 'architecture' && <Architecture />}
        {page === 'pricing' && <Pricing onSignUp={() => openAuth('signup')} />}
        {page === 'howto' && <HowToUse onNavigate={navigate} />}
        {page === 'docs' && <Documentation />}
        {page === 'legal' && <Legal />}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <Footer onNavigate={navigate} onSignIn={() => openAuth('login')} onSignUp={() => openAuth('signup')} />

      {/* ── Auth Modal ─────────────────────────────────────────────────────── */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthSuccess={onAuthSuccess} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Brand Mark                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

/** The Vortex logo image — no borders, reasonable size via className. */
function VortexLogo({ className = '' }: { className?: string }) {
  return <img src="/logo.png" alt="Vortex" className={className} />;
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Background                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Grid layer */}
      <div className="bg-grid-map absolute inset-0 opacity-30" />

      {/* Ambient mesh glows */}
      <div className="bg-mesh absolute inset-0" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Navbar                                                                       */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Navbar({
  onNavigate,
  onSignIn,
  onSignUp,
  activePage,
}: {
  onNavigate: (page: Page) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  activePage: Page;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems: { id: Page; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Features' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'howto', label: 'How to Use' },
    { id: 'docs', label: 'Docs' },
    { id: 'legal', label: 'Legal' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'glass border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <button onClick={() => onNavigate('home')} className="flex items-center gap-3">
          <VortexLogo className="h-9 w-9" />
          <span className="text-gradient text-xl font-bold tracking-tight">Vortex</span>
        </button>

        {/* Nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                ${activePage === item.id
                  ? 'text-white bg-white/5'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <button onClick={onSignIn} className="btn-glass !py-2 !px-4 text-sm">
            Sign In
          </button>
          <button onClick={onSignUp} className="btn-kinetic !py-2 !px-4 text-sm">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Home / Hero                                                                   */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Hero({ onSignUp, onSignIn, onNavigate }: { onSignUp: () => void; onSignIn: () => void; onNavigate: (page: Page) => void }) {
  return (
    <section id="home" className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
      {/* Large brand mark with ambient glow — 3x original size */}
      <div className="relative mb-10">
        <div className="absolute inset-0 animate-glow-breathe rounded-full bg-gradient-to-br from-spectrum-blue/30 to-spectrum-cyan/20 blur-3xl" />
        <div className="relative">
          <VortexLogo className="h-72 w-72 animate-fade-in" />
        </div>
      </div>

      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-white/40 backdrop-blur-md">
        <span className="status-dot status-live" />
        High-performance Backend-as-a-Service · Now in Production
      </p>

      <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl animate-fade-in">
        <span className="text-gradient">Build backends at</span>
        <br />
        <span className="text-white">the speed of thought.</span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-lg text-white/40 animate-fade-in">
        Vortex is the all-in-one BaaS platform that gives you authentication, databases,
        object storage, and realtime sync — all in one glassmorphic console. Deploy in
        minutes, scale to millions, and never worry about infrastructure again.
      </p>

      {/* CTA buttons */}
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row animate-fade-in">
        <button onClick={onSignUp} className="btn-kinetic !px-8 !py-4 text-base">
          Start Building Free
        </button>
        <button onClick={() => onNavigate('pricing')} className="btn-glass !px-8 !py-4 text-base">
          View Pricing
        </button>
      </div>

      {/* Stats */}
      <div className="mt-20 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
        {[
          { value: '<50ms', label: 'Realtime latency' },
          { value: '99.9%', label: 'Uptime SLA' },
          { value: '4', label: 'Core services' },
          { value: '∞', label: 'Scalable' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-gradient text-2xl font-bold">{stat.value}</div>
            <div className="mt-1 text-xs text-white/30">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Home: Feature preview                                                       */
/* ══════════════════════════════════════════════════════════════════════════════ */

function HomeFeatures({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const preview = [
    { icon: IconAuth, title: 'Authentication', desc: 'JWT, bcrypt, RBAC — complete auth from scratch.' },
    { icon: IconDatabase, title: 'Database', desc: 'Dynamic CRUD over PostgreSQL with 8 filter operators.' },
    { icon: IconStorage, title: 'Storage', desc: 'Cloudflare R2 with HMAC-signed presigned URLs.' },
    { icon: IconRealtime, title: 'Realtime', desc: 'Sub-50ms WebSocket pub/sub for live data feeds.' },
  ];

  return (
    <section className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-gradient text-sm font-semibold uppercase tracking-widest">Platform</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Everything you need, nothing you don't
          </h2>
          <p className="mt-4 text-base text-white/40 sm:text-lg">
            Four core services, one unified platform. No separate providers, no glue code.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {preview.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.title}
                onClick={() => onNavigate('features')}
                className="glass group p-6 text-left transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{feature.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button onClick={() => onNavigate('features')} className="btn-glass !px-6 !py-3 text-sm">
            Explore all features
          </button>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  SVG Icons                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function IconAuth({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDatabase({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function IconStorage({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function IconRealtime({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
    </svg>
  );
}

function IconShield({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconConsole({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 9l3 3-3 3" />
      <path d="M13 15h4" />
      <path d="M8 21h8" />
    </svg>
  );
}

function IconBook({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8V4z" />
    </svg>
  );
}

function IconKey({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9" />
      <path d="M16 16l2-2" />
      <path d="M14 18l2-2" />
    </svg>
  );
}

function IconCode({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6l-5 6 5 6" />
      <path d="M16 6l5 6-5 6" />
    </svg>
  );
}

function IconUpload({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

function IconDeploy({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function IconArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Features page                                                                   */
/* ══════════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: IconAuth,
    title: 'Authentication Engine',
    description:
      'A complete auth system built from scratch. JWT-based access and refresh tokens, bcrypt password hashing with a work factor of 12, and three-tier role-based access control (admin, developer, viewer). Every endpoint is protected by middleware that validates tokens and enforces RBAC before any data is touched. Support for OAuth providers is ready to plug in.',
    points: ['JWT access + refresh tokens', 'bcrypt password hashing (cost 12)', 'RBAC: admin / developer / viewer', 'Signup, login, and /me endpoints'],
  },
  {
    icon: IconDatabase,
    title: 'Database Gateway',
    description:
      'A dynamic CRUD interface over PostgreSQL that lets your frontend query, insert, update, and delete rows without writing a single SQL statement. Built-in query filters support eight operators (eq, neq, gt, gte, lt, lte, like, in), pagination, and ordering. Every query is gated by RBAC — the role determines which tables and which actions are permitted. Column names are validated to prevent SQL injection.',
    points: ['Dynamic CRUD over PostgreSQL', '8 query filter operators', 'Pagination and ordering', 'RBAC on every query', 'SQL injection protection'],
  },
  {
    icon: IconStorage,
    title: 'Storage Controller',
    description:
      'An abstracted storage layer that works with Cloudflare R2 (zero egress fees) or local disk for development. Generate HMAC-signed presigned upload and download URLs so clients can transfer files directly to storage without proxying through the server. Object metadata is tracked in PostgreSQL with owner scoping, content types, and ETags. Switch drivers with a single environment variable.',
    points: ['Cloudflare R2 or local disk', 'HMAC-signed presigned URLs', 'Direct client-to-storage uploads', 'Owner-scoped object management', 'Content type and ETag tracking'],
  },
  {
    icon: IconRealtime,
    title: 'Realtime WebSocket Hub',
    description:
      'A pub/sub engine that broadcasts database changes to connected clients in under 50ms. Clients subscribe to specific tables and receive insert, update, and delete events as they happen. The WebSocket hub handles connection lifecycle, subscription management, and message routing. Ideal for live dashboards, collaborative editing, and real-time data feeds.',
    points: ['Sub-50ms event broadcast', 'Subscribe / unsubscribe to tables', 'Insert, update, delete events', 'Connection lifecycle management', 'Filtered subscriptions'],
  },
  {
    icon: IconShield,
    title: 'Security & Infrastructure',
    description:
      'Hardened by default. Helmet sets security headers, CORS is configurable, and all input is validated with Zod schemas before it reaches business logic. Centralized error handling ensures consistent API responses. The entire stack is containerized with Docker and docker-compose, with health checks for PostgreSQL, Redis, and the server.',
    points: ['Helmet security headers', 'Zod schema validation', 'Centralized error handling', 'Docker containerization', 'Health-checked services'],
  },
  {
    icon: IconConsole,
    title: 'Glassmorphic Console',
    description:
      'A beautiful, interactive admin console built with React, Vite, and Tailwind CSS. The UI implements the N.O Group design system: an AMOLED pure black canvas, frosted glass panels with backdrop blur, a six-stop chromatic gradient palette, animated branding, and ambient glow effects. The dashboard includes overview, database explorer, storage manager, and realtime event stream views.',
    points: ['AMOLED pure black canvas', 'Frosted glass panels (backdrop blur)', '6-stop chromatic gradient palette', 'Animated Vortex branding', '4 dashboard views'],
  },
];

function Features() {
  return (
    <section id="features" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need to build a backend"
          subtitle="Four core services, one unified platform. No separate providers, no glue code, no infrastructure headaches."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; points: string[] } }) {
  const Icon = feature.icon;
  return (
    <div className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-3 text-lg font-semibold text-white">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-white/40">{feature.description}</p>
      <ul className="mt-4 space-y-2">
        {feature.points.map((point) => (
          <li key={point} className="flex items-center gap-2 text-xs text-white/50">
            <IconArrowRight className="h-3 w-3 flex-shrink-0 text-spectrum-cyan/70" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Architecture page                                                              */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Architecture() {
  const steps = [
    { num: '01', title: 'Authenticate', desc: 'Users sign up or log in through the Auth Gateway. The server validates credentials, hashes passwords with bcrypt, and issues JWT access and refresh tokens.' },
    { num: '02', title: 'Query & Mutate', desc: 'The frontend calls the Database Gateway with a table name, filters, and operation. The server validates the request, checks RBAC, and executes the query against PostgreSQL.' },
    { num: '03', title: 'Broadcast Changes', desc: 'When a row is inserted, updated, or deleted, the Realtime Hub broadcasts the event to all subscribed WebSocket clients in under 50ms.' },
    { num: '04', title: 'Store Files', desc: 'The Storage Controller generates HMAC-signed presigned URLs. Clients upload directly to Cloudflare R2, and object metadata is recorded in the database.' },
  ];

  return (
    <section id="architecture" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Architecture"
          title="How Vortex works"
          subtitle="A clean, modular architecture where each service has a single job and they compose into a complete backend platform."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="glass relative p-6">
              <div className="text-gradient text-3xl font-bold">{step.num}</div>
              <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/40">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Architecture diagram */}
        <div className="glass mt-8 p-8">
          <h3 className="mb-4 text-sm font-medium text-white/60">System Components</h3>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <ArchNode label="Vortex Dashboard" color="from-spectrum-blue/20 to-spectrum-cyan/10" />
            <Arrow />
            <ArchNode label="Express Server" color="from-spectrum-lavender/20 to-spectrum-coral/10" />
            <Arrow />
            <div className="flex flex-col gap-2">
              <ArchNode label="PostgreSQL" color="from-spectrum-cyan/20 to-spectrum-mint/10" />
              <ArchNode label="Cloudflare R2" color="from-spectrum-mint/20 to-spectrum-green/10" />
            </div>
            <Arrow />
            <ArchNode label="WebSocket Hub" color="from-spectrum-blue/20 to-spectrum-lavender/10" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchNode({ label, color }: { label: string; color: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.08] bg-gradient-to-br ${color} px-4 py-3 text-white/70 font-medium`}>
      {label}
    </div>
  );
}

function Arrow() {
  return <IconArrowRight className="h-4 w-4 text-white/20" />;
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Pricing page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Pricing({ onSignUp }: { onSignUp: () => void }) {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/mo',
      desc: 'For individuals and side projects getting started with Vortex.',
      features: [
        '1 project',
        '1 GB database',
        '1 GB storage',
        '10K realtime events/day',
        'Community support',
      ],
      cta: 'Start Free',
      highlight: false,
    },
    {
      name: 'Starter',
      price: '$9',
      period: '/mo',
      desc: 'For developers building personal apps and experiments.',
      features: [
        '3 projects',
        '5 GB database',
        '10 GB storage',
        '100K realtime events/day',
        'Email support',
      ],
      cta: 'Choose Starter',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/mo',
      desc: 'For teams building production applications with Vortex.',
      features: [
        '10 projects',
        '25 GB database',
        '50 GB storage',
        '500K realtime events/day',
        'Email support',
        'Custom domains',
        'Priority queue',
      ],
      cta: 'Choose Pro',
      highlight: true,
    },
    {
      name: 'Business',
      price: '$79',
      period: '/mo',
      desc: 'For growing applications that need more power and scale.',
      features: [
        '25 projects',
        '100 GB database',
        '200 GB storage',
        '2M realtime events/day',
        'Priority support',
        'Advanced analytics',
        'Webhook integrations',
        'SLA 99.9% uptime',
      ],
      cta: 'Choose Business',
      highlight: false,
    },
    {
      name: 'Enterprise',
      price: '$199',
      period: '/mo',
      desc: 'For high-traffic applications that need maximum performance.',
      features: [
        'Unlimited projects',
        '500 GB database',
        '1 TB storage',
        '10M realtime events/day',
        'Dedicated support',
        'Dedicated infrastructure',
        'Custom SLAs',
        'On-premise option',
        'SSO & SAML',
      ],
      cta: 'Contact Sales',
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free, upgrade when you need more. No hidden fees, no surprise bills. Cancel anytime."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                glass relative flex flex-col p-6 transition-all duration-300
                ${plan.highlight
                  ? 'border-spectrum-cyan/30 shadow-[0_0_40px_rgba(0,210,255,0.1)]'
                  : 'hover:bg-white/[0.05]'
                }
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-spectrum-blue to-spectrum-cyan px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-white/40">{plan.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-gradient text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-white/30">{plan.period}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/50">
                    <IconCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-interactive-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className={`mt-6 w-full ${plan.highlight ? 'btn-kinetic' : 'btn-glass'} !py-3 text-sm`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-white/30">
          All plans include SSL, global CDN, and automatic backups. Prices in USD, billed monthly.
        </p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  How to Use page                                                               */
/* ══════════════════════════════════════════════════════════════════════════════ */

function HowToUse({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <section id="howto" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="How to Use"
          title="Everything you need to use Vortex"
          subtitle="A complete guide covering every feature — from your first sign-up to advanced deployment. This page grows as Vortex grows."
        />

        {/* Quick jump */}
        <div className="glass mt-12 p-6">
          <h3 className="mb-4 text-sm font-medium text-white/60">Jump to a section</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'signup', label: 'Sign Up & Login' },
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'auth', label: 'Authentication' },
              { id: 'database', label: 'Database' },
              { id: 'storage', label: 'Storage' },
              { id: 'realtime', label: 'Realtime' },
              { id: 'security', label: 'Security' },
              { id: 'deploy', label: 'Deployment' },
              { id: 'api', label: 'API Reference' },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-spectrum-cyan/30 hover:text-spectrum-cyan"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-12 space-y-24">
          {/* ── 1. Sign Up & Login ─────────────────────────────────────────────── */}
          <HowToSection id="signup" num="01" title="Sign Up & Login">
            <Step title="Create your account">
              <p>Click <strong>Get Started</strong> in the top-right corner of any page. This opens the auth modal where you can choose <strong>Sign Up</strong> mode.</p>
              <p>Fill in your <strong>email</strong>, <strong>password</strong> (at least 8 characters), and <strong>full name</strong>. Your password is hashed with bcrypt (cost factor 12) before it's stored — the plaintext never touches the database.</p>
              <p>Click <strong>Create Account</strong>. You'll be signed in immediately and redirected to the Vortex dashboard.</p>
            </Step>
            <Step title="Sign in to your account">
              <p>Click <strong>Sign In</strong> in the top-right corner. Enter your email and password, then click <strong>Sign In</strong>.</p>
              <p>If you have 2FA enabled, you'll be prompted for a one-time code before access is granted.</p>
              <p>Your session is stored in <code>localStorage</code>. You can stay signed in across browser restarts — the token is validated on every request.</p>
            </Step>
            <Step title="Logging out">
              <p>Click your email in the sidebar and select <strong>Logout</strong>. This clears your token and returns you to the landing page.</p>
              <p>If your token expires, the dashboard automatically redirects you back to login.</p>
            </Step>
          </HowToSection>

          {/* ── 2. Dashboard ──────────────────────────────────────────────────── */}
          <HowToSection id="dashboard" num="02" title="The Vortex Dashboard">
            <Step title="Overview">
              <p>The <strong>Overview</strong> page is your home base. It shows engine health, WebSocket connection count, and a live event stream of recent database changes.</p>
              <p>The event stream updates in real time — you'll see inserts, updates, and deletes as they happen across all tables.</p>
            </Step>
            <Step title="Navigation">
              <p>The left sidebar lists all available pages. Click any item to navigate:</p>
              <ul>
                <li><strong>Overview</strong> — health, stats, live event feed</li>
                <li><strong>Database</strong> — browse tables, query and edit rows</li>
                <li><strong>SQL</strong> — run raw SQL queries (admin only)</li>
                <li><strong>Realtime</strong> — monitor WebSocket connections and events</li>
                <li><strong>Storage</strong> — browse, upload, and manage files</li>
                <li><strong>Apps</strong> — manage connected applications</li>
                <li><strong>Functions</strong> — deploy and manage serverless functions</li>
                <li><strong>Auth</strong> — user management and authentication settings</li>
                <li><strong>Policies</strong> — configure RBAC rules and access control</li>
                <li><strong>OAuth</strong> — set up OAuth/OIDC provider integration</li>
                <li><strong>Notifications</strong> — manage notification channels</li>
                <li><strong>Webhooks</strong> — configure outbound webhook events</li>
                <li><strong>Audit</strong> — view all audit log entries</li>
                <li><strong>API Keys</strong> — create and manage API key tokens</li>
                <li><strong>Flags</strong> — manage feature flags</li>
                <li><strong>Vector</strong> — vector search and embeddings</li>
                <li><strong>Cron</strong> — schedule recurring jobs</li>
                <li><strong>Shield</strong> — security policies and firewall rules</li>
                <li><strong>Media</strong> — media library and transforms</li>
              </ul>
            </Step>
          </HowToSection>

          {/* ── 3. Authentication ─────────────────────────────────────────────── */}
          <HowToSection id="auth" num="03" title="Authentication & Users">
            <Step title="How authentication works">
              <p>Vortex uses <strong>JWT (JSON Web Tokens)</strong> for authentication. When you sign up or log in, the server returns an <strong>access token</strong> and a <strong>refresh token</strong>.</p>
              <p>The access token is included in every API request via the <code>Authorization: Bearer &lt;token&gt;</code> header. Each token contains the user's <code>sub</code> (user ID), <code>email</code>, and <code>role</code>.</p>
              <p>Tokens are validated by middleware on every request — if a token is invalid or expired, the request is rejected with a <code>401 Unauthorized</code>.</p>
            </Step>
            <Step title="User roles (RBAC)">
              <p>Vortex implements three-tier <strong>Role-Based Access Control</strong>:</p>
              <ul>
                <li><strong>Admin</strong> — full access to everything, including raw SQL execution, policy management, and user administration. Can bypass row scoping.</li>
                <li><strong>Developer</strong> — can create, read, update, and delete data in tables they have access to. Cannot manage users or policies.</li>
                <li><strong>Viewer</strong> — read-only access. Can query data but cannot modify anything.</li>
              </ul>
              <p>Roles are enforced on every database operation. The role in your JWT token determines what you can do — there is no way to bypass this.</p>
            </Step>
            <Step title="API keys">
              <p>For server-to-server integrations, create an <strong>API key</strong> from the API Keys page. API keys function like user tokens but are tied to a specific application.</p>
              <p>Each API key has a name, scope (which tables/operations it can access), and an expiration date. You can revoke a key at any time.</p>
              <p>Use API keys in the <code>Authorization: Bearer &lt;api-key&gt;</code> header, exactly like a user token.</p>
            </Step>
            <Step title="OAuth / OIDC">
              <p>Vortex supports <strong>OAuth 2.0</strong> and <strong>OpenID Connect</strong> for third-party login (Google, GitHub, etc.). Configure providers from the <strong>OAuth</strong> page.</p>
              <p>Set up your provider's client ID and secret, configure the redirect URI, and users will see the provider's login button alongside the email/password form.</p>
            </Step>
          </HowToSection>

          {/* ── 4. Database ───────────────────────────────────────────────────── */}
          <HowToSection id="database" num="04" title="Database Operations">
            <Step title="The Database page">
              <p>The <strong>Database</strong> page is your table browser. It lists all tables in your PostgreSQL database and lets you query, insert, update, and delete rows — all without writing SQL.</p>
              <p>Click any table to open its data view. You'll see a paginated table of rows with sortable columns.</p>
            </Step>
            <Step title="Querying data">
              <p>Use the <strong>filters</strong> bar to build queries dynamically. Vortex supports 8 comparison operators:</p>
              <ul>
                <li><code>eq</code> — equals</li>
                <li><code>neq</code> — not equals</li>
                <li><code>gt</code> / <code>gte</code> — greater than (or equal)</li>
                <li><code>lt</code> / <code>lte</code> — less than (or equal)</li>
                <li><code>like</code> — pattern matching (e.g. <code>%search%</code>)</li>
                <li><code>in</code> — match any value in a list</li>
              </ul>
              <p>Combine multiple filters, apply ordering, and paginate through results. All queries are validated against the table schema and enforced by RBAC.</p>
            </Step>
            <Step title="Creating, updating, and deleting">
              <p>Click <strong>Insert Row</strong> to add a new record. Fill in the column values and submit — the row is immediately visible to all realtime subscribers.</p>
              <p>Click any row to edit it. Changes are saved with a single click and broadcast to subscribed clients in under 50ms.</p>
              <p>Use the <strong>Delete</strong> action on a row to remove it. Deletions are also broadcast as realtime events.</p>
            </Step>
            <Step title="Raw SQL (admin only)">
              <p>Admins can access the <strong>SQL</strong> page to run raw PostgreSQL queries directly. This is for advanced use cases — complex joins, aggregates, or operations that can't be expressed through the dynamic CRUD interface.</p>
              <p>All SQL queries are logged in the audit trail. Admin-only — developers and viewers cannot access this page.</p>
            </Step>
            <Step title="Schema migrations">
              <p>Vortex runs database migrations automatically on startup (when <code>AUTO_MIGRATE</code> is enabled). Migrations create and update tables, indexes, and constraints.</p>
              <p>Migration files are stored in <code>apps/vortex-server/migrations/</code>. When you add new tables or columns, create a new migration file — Vortex will apply it on the next restart.</p>
            </Step>
          </HowToSection>

          {/* ── 5. Storage ───────────────────────────────────────────────────── */}
          <HowToSection id="storage" num="05" title="Storage & File Management">
            <Step title="The Storage page">
              <p>The <strong>Storage</strong> page is your file browser. It lists all stored objects with their metadata: file name, size, content type, owner, and upload date.</p>
              <p>You can browse the object list, download files, and delete objects you own.</p>
            </Step>
            <Step title="Uploading files">
              <p>Click <strong>Upload</strong> and select a file from your computer. The file is uploaded directly to storage (Cloudflare R2 by default) — it does not pass through the Vortex server.</p>
              <p>For large files, Vortex supports <strong>multipart uploads</strong> — the file is split into chunks, uploaded in parallel, and reassembled on the server. This is faster and more reliable for big files.</p>
            </Step>
            <Step title="Presigned URLs">
              <p>Vortex generates <strong>HMAC-signed presigned URLs</strong> for both uploads and downloads. These are time-limited URLs that let clients transfer files directly to/from storage without going through the Vortex server.</p>
              <p>This means your server never handles the file bytes — it only generates the signed URL and records the metadata. Ideal for high-throughput applications.</p>
              <p>To generate a presigned upload URL via the API:</p>
              <pre><code>{`POST /v1/storage/presign-upload
{ "key": "uploads/photo.jpg", "contentType": "image/jpeg" }

Response:
{ "url": "https://...signed-url...", "key": "uploads/photo.jpg" }`}</code></pre>
              <p>Upload directly to that URL, then call <code>POST /v1/storage/objects</code> to record the metadata.</p>
            </Step>
            <Step title="Storage drivers">
              <p>Vortex supports multiple storage drivers. Switch between them with the <code>STORAGE_PROVIDER</code> environment variable:</p>
              <ul>
                <li><strong>cloudflare_r2</strong> — Cloudflare R2 (zero egress fees, recommended for production)</li>
                <li><strong>aws_s3</strong> — Amazon S3</li>
                <li><strong>digitalocean_spaces</strong> — DigitalOcean Spaces</li>
                <li><strong>gcs</strong> — Google Cloud Storage</li>
                <li><strong>azure_blob</strong> — Azure Blob Storage</li>
                <li><strong>local_disk</strong> — Local filesystem (for development)</li>
              </ul>
              <p>Each driver has its own configuration environment variables (e.g. <code>R2_BUCKET</code>, <code>S3_BUCKET</code>, <code>GCS_BUCKET</code>). See <code>.env.example</code> for the full list.</p>
            </Step>
          </HowToSection>

          {/* ── 6. Realtime ───────────────────────────────────────────────────── */}
          <HowToSection id="realtime" num="06" title="Realtime WebSocket Hub">
            <Step title="What is the Realtime Hub?">
              <p>The Realtime Hub is a WebSocket-based pub/sub engine. When data changes in your database (inserts, updates, deletes), the hub broadcasts events to all connected clients in <strong>under 50ms</strong>.</p>
              <p>This is how the dashboard's live event feed works, and how you can build live dashboards, collaborative editing, or real-time data feeds in your own app.</p>
            </Step>
            <Step title="Connecting">
              <p>Connect to the WebSocket endpoint at <code>ws://&lt;your-host&gt;/v1/realtime</code>. Pass your JWT token either as a query parameter or via the <code>vortex:auth</code> message:</p>
              <pre><code>{`// Query parameter
ws://localhost:4000/v1/realtime?token=your.jwt.token

// Or authenticate after connecting
{ "type": "vortex:auth", "token": "your.jwt.token" }`}</code></pre>
              <p>If you don't authenticate, you can still connect — but you cannot subscribe to any channels.</p>
            </Step>
            <Step title="Subscribing to changes">
              <p>Subscribe to table changes by sending a <code>vortex:subscribe</code> message with a channel name:</p>
              <pre><code>{`// Subscribe to all changes on the "users" table
{ "type": "vortex:subscribe", "channel": "table:users" }

// Subscribe to all tables (wildcard)
{ "type": "vortex:subscribe", "channel": "table:*" }`}</code></pre>
              <p>You'll receive <code>vortex:event</code> messages whenever a matching change occurs:</p>
              <pre><code>{`{
  "type": "vortex:event",
  "channel": "table:users",
  "event": "insert",
  "payload": { "id": "123", "email": "user@example.com", "role": "admin" }
}`}</code></pre>
              <p>Event types are <code>insert</code>, <code>update</code>, and <code>delete</code>.</p>
            </Step>
            <Step title="Rooms & broadcasts">
              <p>Beyond table subscriptions, you can create <strong>rooms</strong> for custom pub/sub:</p>
              <pre><code>{`// Join a room
{ "type": "vortex:subscribe", "channel": "room:chat" }

// Broadcast to everyone in the room
{ "type": "vortex:broadcast", "channel": "room:chat", "event": "message", "payload": { "text": "Hello!" } }`}</code></pre>
              <p>All room members receive the broadcast. This is ideal for chat, notifications, or any custom realtime feature.</p>
            </Step>
            <Step title="Presence">
              <p>Track who's online with the <code>vortex:presence</code> message:</p>
              <pre><code>{`// Track presence in a room
{ "type": "vortex:presence", "action": "track", "channel": "room:chat", "state": { "name": "Alice" } }`}</code></pre>
              <p>You'll receive presence updates whenever someone joins or leaves.</p>
            </Step>
          </HowToSection>

          {/* ── 7. Security ───────────────────────────────────────────────────── */}
          <HowToSection id="security" num="07" title="Security & Access Control">
            <Step title="Security headers">
              <p>Vortex uses <strong>Helmet</strong> to set security headers on all HTTP responses. This includes CSP, XSS protection, frame-ancestor protection, and more.</p>
              <p>These headers are applied automatically — no configuration needed.</p>
            </Step>
            <Step title="CORS configuration">
              <p>CORS (Cross-Origin Resource Sharing) is controlled by the <code>CORS_ORIGINS</code> environment variable. Set it to a comma-separated list of allowed origins:</p>
              <pre><code># Allow specific origins
CORS_ORIGINS=https://app.example.com,https://admin.example.com

# Allow all origins (development only!)
CORS_ORIGINS=*</code></pre>
              <p>In production, always set specific origins — never use <code>*</code>.</p>
            </Step>
            <Step title="Password security">
              <p>Passwords are hashed with <strong>bcrypt</strong> at a cost factor of 12. This is computationally expensive to brute-force, making stolen database dumps useless for recovering passwords.</p>
              <p>The plaintext password is never stored, logged, or transmitted after the initial signup/login request.</p>
            </Step>
            <Step title="JWT security">
              <p>JWT tokens are signed with <strong>HS256</strong> using the <code>JWT_SECRET</code> environment variable. In production, Vortex <strong>refuses to start</strong> if <code>JWT_SECRET</code> is still the default dev value.</p>
              <p>Set a long, random secret:</p>
              <pre><code>JWT_SECRET=your-long-random-secret-here</code></pre>
              <p>Tokens have an expiry — access tokens expire after 1 hour, refresh tokens after 30 days. Refresh tokens can be used to obtain new access tokens without re-entering credentials.</p>
            </Step>
            <Step title="Input validation">
              <p>All API input is validated with <strong>Zod schemas</strong> before it reaches business logic. Invalid input is rejected with a <code>400 Bad Request</code> and a descriptive error message.</p>
              <p>This prevents injection attacks, malformed data, and unexpected behavior at the API boundary.</p>
            </Step>
            <Step title="Audit logs">
              <p>Every significant action — signups, logins, data mutations, policy changes — is recorded in the <strong>audit log</strong>. View it from the <strong>Audit</strong> page.</p>
              <p>Audit entries include the user, action, target resource, timestamp, and any metadata. This is essential for compliance and security investigations.</p>
            </Step>
            <Step title="Shield (firewall)">
              <p>The <strong>Shield</strong> page lets you configure security policies and firewall rules at the API level. Use it to rate-limit requests, block suspicious patterns, or enforce IP allowlists/denylists.</p>
            </Step>
          </HowToSection>

          {/* ── 8. Deployment ─────────────────────────────────────────────────── */}
          <HowToSection id="deploy" num="08" title="Deployment & Configuration">
            <Step title="Docker deployment">
              <p>Vortex is fully containerized. The fastest way to deploy is with <strong>Docker Compose</strong>:</p>
              <pre><code># 1. Clone the repo
git clone https://github.com/NO-Group/Vortex.git
cd Vortex

# 2. Copy the environment file and fill in your values
cp .env.example .env
# Edit .env with your database, storage, and JWT settings

# 3. Build and start
docker compose up -d --build</code></pre>
              <p>This starts the Vortex server, PostgreSQL, and Redis. Check the logs with <code>docker compose logs -f</code>.</p>
            </Step>
            <Step title="Required environment variables">
              <p>Before deploying to production, set these variables in your <code>.env</code> file:</p>
              <ul>
                <li><code>JWT_SECRET</code> — A long random string for signing JWT tokens. <strong>Never use the default in production.</strong></li>
                <li><code>DATABASE_URL</code> — PostgreSQL connection string (e.g. <code>postgres://user:pass@host:5432/vortex</code>)</li>
                <li><code>REDIS_URL</code> — Redis connection string for the realtime bridge</li>
                <li><code>STORAGE_PROVIDER</code> — Which storage driver to use (<code>cloudflare_r2</code>, <code>aws_s3</code>, <code>local_disk</code>, etc.)</li>
                <li><code>CORS_ORIGINS</code> — Comma-separated list of allowed origins</li>
                <li><code>PORT</code> — Server port (default: 4000)</li>
                <li><code>AUTO_MIGRATE</code> — Set to <code>true</code> to run migrations on startup</li>
              </ul>
              <p>See <code>.env.example</code> in the repository root for the complete list with descriptions.</p>
            </Step>
            <Step title="Caddy reverse proxy">
              <p>A <strong>Caddyfile</strong> is included for reverse proxying. Caddy provides automatic HTTPS, making it the recommended front-end proxy for production:</p>
              <pre><code>{`# Caddyfile
vortex.yourdomain.com {
    reverse_proxy localhost:4000
}`}</code></pre>
              <p>Caddy automatically obtains and renews SSL certificates. No manual certificate management needed.</p>
            </Step>
            <Step title="Health checks">
              <p>Vortex exposes a health endpoint at <code>GET /healthz</code>. This returns the server status, engine version, and current WebSocket connection count:</p>
              <pre><code>{`{
  "status": "ok",
  "engine": "vortex",
  "version": "0.1.0",
  "realtime": { "connections": 12 }
}`}</code></pre>
              <p>Use this for monitoring, load balancer health checks, or uptime monitoring services.</p>
            </Step>
          </HowToSection>

          {/* ── 9. API Reference ──────────────────────────────────────────────── */}
          <HowToSection id="api" num="09" title="API Reference">
            <Step title="API base URL">
              <p>All API endpoints are under <code>/v1</code>. The base URL is:</p>
              <pre><code>https://your-host/v1</code></pre>
              <p>Every request (except signup/login) must include your JWT token:</p>
              <pre><code>Authorization: Bearer your.jwt.token</code></pre>
            </Step>
            <Step title="Key endpoints">
              <ul>
                <li><code>POST /v1/auth/signup</code> — Create a new account</li>
                <li><code>POST /v1/auth/login</code> — Log in and get tokens</li>
                <li><code>GET /v1/auth/me</code> — Get your user profile</li>
                <li><code>GET /v1/db/:table</code> — Query table data (with filters)</li>
                <li><code>POST /v1/db/:table</code> — Insert a row</li>
                <li><code>PATCH /v1/db/:table/:id</code> — Update a row</li>
                <li><code>DELETE /v1/db/:table/:id</code> — Delete a row</li>
                <li><code>GET /v1/storage/objects</code> — List stored objects</li>
                <li><code>POST /v1/storage/presign-upload</code> — Get a signed upload URL</li>
                <li><code>POST /v1/storage/presign-download</code> — Get a signed download URL</li>
                <li><code>GET /healthz</code> — Health check (no auth needed)</li>
              </ul>
            </Step>
            <Step title="Error format">
              <p>All errors follow a consistent JSON format:</p>
              <pre><code>{`{
  "error": {
    "message": "Human-readable error message",
    "code": "error_code_string",
    "details": { /* optional, validation errors */ }
  }
}`}</code></pre>
              <p>Common HTTP status codes:</p>
              <ul>
                <li><code>200</code> — Success</li>
                <li><code>201</code> — Created (e.g. signup, insert)</li>
                <li><code>400</code> — Bad request (invalid input)</li>
                <li><code>401</code> — Unauthorized (missing or invalid token)</li>
                <li><code>403</code> — Forbidden (insufficient RBAC role)</li>
                <li><code>404</code> — Not found</li>
                <li><code>500</code> — Server error</li>
              </ul>
            </Step>
          </HowToSection>
        </div>

        {/* Navigation hint */}
        <div className="glass mt-16 p-6 text-center">
          <p className="text-sm text-white/40">
            This guide is continuously updated as Vortex grows. New features will be documented here as they're added.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button onClick={() => onNavigate('features')} className="btn-glass !py-2 !px-4 text-sm">
              View Features
            </button>
            <button onClick={() => onNavigate('pricing')} className="btn-glass !py-2 !px-4 text-sm">
              See Pricing
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowToSection({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <span className="text-gradient text-2xl font-bold">{num}</span>
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      <div className="mt-6 space-y-8">{children}</div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-spectrum-cyan">{title}</h4>
      <div className="space-y-2 text-sm leading-relaxed text-white/50">
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Documentation page                                                             */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Documentation() {
  const docs = [
    { title: 'Getting Started', desc: 'Set up your Vortex project in under 5 minutes. Install the CLI, create a project, and deploy.', icon: IconBook },
    { title: 'Authentication', desc: 'Understand the JWT token flow, refresh tokens, and how to authenticate API requests from your frontend.', icon: IconKey },
    { title: 'Database API', desc: 'Full reference for the dynamic CRUD endpoints — filters, operators, pagination, and RBAC.', icon: IconCode },
    { title: 'Storage & Uploads', desc: 'Generate presigned URLs, upload files directly to R2, and manage object metadata.', icon: IconUpload },
    { title: 'Realtime Subscriptions', desc: 'Connect to the WebSocket hub, subscribe to table changes, and handle live events.', icon: IconRealtime },
    { title: 'Deployment', desc: 'Deploy Vortex with Docker, configure environment variables, and scale for production.', icon: IconDeploy },
  ];

  return (
    <section id="docs" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Documentation"
          title="Everything you need to build"
          subtitle="Comprehensive guides and API references for every part of the Vortex platform."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => {
            const Icon = doc.icon;
            return (
              <div key={doc.title} className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] cursor-pointer">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-spectrum-cyan transition-colors">{doc.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/40">{doc.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-interactive-focus opacity-0 transition-opacity group-hover:opacity-100">
                  Read more
                  <IconArrowRight className="h-3 w-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Legal page                                                                     */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Legal() {
  return (
    <section id="legal" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Legal"
          title="Privacy & Terms"
          subtitle="The legal documents that govern your use of the Vortex platform."
        />

        <div className="space-y-6">
          <LegalCard title="Privacy Policy" content={
            <>
              <p>Vortex is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your data when you use the Vortex platform.</p>
              <h4>Data We Collect</h4>
              <p>We collect information necessary to provide the service: account credentials (email and hashed password), usage data (API calls, storage consumption), and content you store through the platform (database rows, uploaded files).</p>
              <h4>How We Use Your Data</h4>
              <p>Your data is used solely to operate the Vortex platform — authenticating users, executing database queries, storing and serving files, and broadcasting realtime events. We do not sell your data to third parties.</p>
              <h4>Data Security</h4>
              <p>Passwords are hashed with bcrypt at a cost factor of 12. Authentication tokens are signed with JWT and transmitted over HTTPS. Database queries are validated and RBAC-enforced. Storage operations use HMAC-signed presigned URLs.</p>
              <h4>Data Retention</h4>
              <p>Your data is retained as long as your account is active. You can delete objects, rows, and your account at any time. Upon account deletion, all associated data is permanently removed.</p>
            </>
          } />

          <LegalCard title="Terms of Service" content={
            <>
              <p>By using the Vortex platform, you agree to these Terms of Service.</p>
              <h4>Acceptable Use</h4>
              <p>You agree not to use Vortex for illegal activities, to attempt unauthorized access to any system or data, or to circumvent the platform's security measures. The platform's RBAC system is designed to enforce access controls — do not attempt to bypass them.</p>
              <h4>Service Availability</h4>
              <p>Vortex aims to provide a reliable service but does not guarantee uninterrupted availability. The platform is provided "as is" without warranties of any kind. We strive for high uptime but are not liable for any damages arising from service interruptions.</p>
              <h4>User Content</h4>
              <p>You retain ownership of all content you store on Vortex — database rows, uploaded files, and any other data. You are responsible for the content you store and for ensuring you have the right to store it.</p>
              <h4>Limitation of Liability</h4>
              <p>To the maximum extent permitted by law, Vortex and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
            </>
          } />
        </div>
      </div>
    </section>
  );
}

function LegalCard({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div className="glass p-8">
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-white/50">
        {content}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Footer                                                                        */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Footer({ onNavigate, onSignIn, onSignUp }: { onNavigate: (page: Page) => void; onSignIn: () => void; onSignUp: () => void }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
              <VortexLogo className="h-8 w-8" />
              <span className="text-gradient text-lg font-bold">Vortex</span>
            </button>
            <p className="mt-3 text-sm text-white/30">
              High-performance Backend-as-a-Service. Build, scale, and ship — faster.
            </p>
          </div>

          {/* Links */}
          <FooterLinks title="Product" links={[
            { label: 'Features', action: () => onNavigate('features') },
            { label: 'Architecture', action: () => onNavigate('architecture') },
            { label: 'Pricing', action: () => onNavigate('pricing') },
          ]} />
          <FooterLinks title="Resources" links={[
            { label: 'How to Use', action: () => onNavigate('howto') },
            { label: 'Documentation', action: () => onNavigate('docs') },
            { label: 'Privacy Policy', action: () => onNavigate('legal') },
            { label: 'Terms of Service', action: () => onNavigate('legal') },
          ]} />
          <FooterLinks title="Account" links={[
            { label: 'Sign In', action: onSignIn },
            { label: 'Sign Up', action: onSignUp },
          ]} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-6 sm:flex-row">
          <p className="text-xs text-white/25">© 2026 Vortex by N.O Group. All rights reserved.</p>
          <p className="text-xs text-white/20">Built with the N.O Group design system</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { label: string; action: () => void }[] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <button
              onClick={link.action}
              className="text-sm text-white/40 transition-colors hover:text-spectrum-cyan"
            >
              {link.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Shared                                                                        */
/* ══════════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-gradient text-sm font-semibold uppercase tracking-widest">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h2>
      <p className="mt-4 text-base text-white/40 sm:text-lg">{subtitle}</p>
    </div>
  );
}

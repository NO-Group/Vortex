import { useState } from 'react';
import { AuthModal } from './AuthModal';
import type { AuthSession } from '../lib/api';

/**
 * Vortex — Landing Page.
 *
 * A large, professional, interactive marketing site with:
 *  - Hero section with animated Vortex branding
 *  - Feature showcase with detailed descriptions
 *  - Architecture / how it works section
 *  - Pricing section
 *  - Documentation & legal pages (Privacy, Terms)
 *  - Footer
 *
 * Sign In / Sign Up buttons appear throughout the page and open
 * the glassmorphic AuthModal overlay when clicked.
 */

export function LandingPage({ onAuthSuccess }: { onAuthSuccess: (session: AuthSession) => void }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeSection, setActiveSection] = useState('home');

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setActiveSection(id);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Global ambient background ───────────────────────────────────────── */}
      <LandingBackground />

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <Navbar
        onNavigate={scrollTo}
        onSignIn={() => openAuth('login')}
        onSignUp={() => openAuth('signup')}
        activeSection={activeSection}
      />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <Hero onSignUp={() => openAuth('signup')} onSignIn={() => openAuth('login')} onScroll={() => scrollTo('features')} />

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <Features />

      {/* ── Architecture / How it works ────────────────────────────────────── */}
      <Architecture />

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <Pricing onSignUp={() => openAuth('signup')} />

      {/* ── Documentation ────────────────────────────────────────────────────── */}
      <Documentation />

      {/* ── Legal: Privacy & Terms ──────────────────────────────────────────── */}
      <Legal />

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <Footer onNavigate={scrollTo} onSignIn={() => openAuth('login')} onSignUp={() => openAuth('signup')} />

      {/* ── Auth Modal (opens from any CTA) ─────────────────────────────────── */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthSuccess={onAuthSuccess} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Background                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Grid layer */}
      <div className="grid-bg absolute inset-0 opacity-30" />

      {/* Large floating orbs */}
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '700px', height: '700px',
          top: '-200px', left: '20%',
          background: 'radial-gradient(circle, #004BFF 0%, transparent 70%)',
          opacity: 0.12,
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '600px', height: '600px',
          top: '30%', right: '-150px',
          background: 'radial-gradient(circle, #A38CFF 0%, transparent 70%)',
          opacity: 0.08,
          animationDelay: '2s',
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '500px', height: '500px',
          bottom: '-100px', left: '10%',
          background: 'radial-gradient(circle, #00D2FF 0%, transparent 70%)',
          opacity: 0.06,
          animationDelay: '4s',
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '400px', height: '400px',
          bottom: '20%', right: '20%',
          background: 'radial-gradient(circle, #00E6A6 0%, transparent 70%)',
          opacity: 0.05,
          animationDelay: '6s',
        }}
      />
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
  activeSection,
}: {
  onNavigate: (id: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  activeSection: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', () => setScrolled(window.scrollY > 20));
  }

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Features' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'docs', label: 'Docs' },
    { id: 'legal', label: 'Legal' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'glass border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg className="vortex-logo h-9 w-9" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="nav-logo" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#004BFF" />
                <stop offset="50%" stopColor="#A38CFF" />
                <stop offset="100%" stopColor="#00D2FF" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" stroke="url(#nav-logo)" strokeWidth="5" opacity="0.7" />
            <circle cx="50" cy="50" r="24" stroke="url(#nav-logo)" strokeWidth="3" opacity="0.5" />
            <circle cx="50" cy="50" r="8" fill="url(#nav-logo)" />
          </svg>
          <span className="text-gradient text-xl font-bold tracking-tight">Vortex</span>
        </div>

        {/* Nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                ${activeSection === item.id
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
          <button onClick={onSignUp} className="btn-primary !py-2 !px-4 text-sm">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Hero                                                                          */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Hero({ onSignUp, onSignIn, onScroll }: { onSignUp: () => void; onSignIn: () => void; onScroll: () => void }) {
  return (
    <section id="home" className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
      {/* Animated Vortex emblem */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-glow-pulse rounded-full bg-gradient-to-br from-anchor/30 to-cyber/20 blur-3xl" />
        <svg className="relative vortex-logo h-24 w-24 animate-vortex-spin" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="hero-logo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#004BFF" />
              <stop offset="33%" stopColor="#A38CFF" />
              <stop offset="66%" stopColor="#00D2FF" />
              <stop offset="100%" stopColor="#00E6A6" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" stroke="url(#hero-logo)" strokeWidth="4" opacity="0.6" />
          <circle cx="50" cy="50" r="34" stroke="url(#hero-logo)" strokeWidth="3" opacity="0.4" />
          <circle cx="50" cy="50" r="22" stroke="url(#hero-logo)" strokeWidth="3" opacity="0.5" />
          <circle cx="50" cy="50" r="12" fill="url(#hero-logo)" />
        </svg>
      </div>

      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-white/40 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-success animate-glow-pulse" />
        High-performance Backend-as-a-Service · Now in Production
      </p>

      <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl animate-slide-up">
        <span className="text-gradient">Build backends at</span>
        <br />
        <span className="text-white">the speed of thought.</span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-lg text-white/40 animate-slide-up">
        Vortex is the all-in-one BaaS platform that gives you authentication, databases,
        object storage, and realtime sync — all in one glassmorphic console. Deploy in
        minutes, scale to millions, and never worry about infrastructure again.
      </p>

      {/* CTA buttons */}
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row animate-slide-up">
        <button onClick={onSignUp} className="btn-primary !px-8 !py-4 text-base">
          Start Building Free
        </button>
        <button onClick={onSignIn} className="btn-glass !px-8 !py-4 text-base">
          Sign In
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

      {/* Scroll indicator */}
      <button
        onClick={onScroll}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 transition-colors hover:text-white/50"
      >
        <svg className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Features                                                                       */
/* ══════════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: '🔐',
    title: 'Authentication Engine',
    description:
      'A complete auth system built from scratch. JWT-based access and refresh tokens, bcrypt password hashing with a work factor of 12, and three-tier role-based access control (admin, developer, viewer). Every endpoint is protected by middleware that validates tokens and enforces RBAC before any data is touched. Support for OAuth providers is ready to plug in.',
    points: ['JWT access + refresh tokens', 'bcrypt password hashing (cost 12)', 'RBAC: admin / developer / viewer', 'Signup, login, and /me endpoints'],
  },
  {
    icon: '🗄️',
    title: 'Database Gateway',
    description:
      'A dynamic CRUD interface over PostgreSQL that lets your frontend query, insert, update, and delete rows without writing a single SQL statement. Built-in query filters support eight operators (eq, neq, gt, gte, lt, lte, like, in), pagination, and ordering. Every query is gated by RBAC — the role determines which tables and which actions are permitted. Column names are validated to prevent SQL injection.',
    points: ['Dynamic CRUD over PostgreSQL', '8 query filter operators', 'Pagination and ordering', 'RBAC on every query', 'SQL injection protection'],
  },
  {
    icon: '📦',
    title: 'Storage Controller',
    description:
      'An abstracted storage layer that works with Cloudflare R2 (zero egress fees) or local disk for development. Generate HMAC-signed presigned upload and download URLs so clients can transfer files directly to storage without proxying through the server. Object metadata is tracked in PostgreSQL with owner scoping, content types, and ETags. Switch drivers with a single environment variable.',
    points: ['Cloudflare R2 or local disk', 'HMAC-signed presigned URLs', 'Direct client-to-storage uploads', 'Owner-scoped object management', 'Content type and ETag tracking'],
  },
  {
    icon: '⚡',
    title: 'Realtime WebSocket Hub',
    description:
      'A pub/sub engine that broadcasts database changes to connected clients in under 50ms. Clients subscribe to specific tables and receive insert, update, and delete events as they happen. The WebSocket hub handles connection lifecycle, subscription management, and message routing. Ideal for live dashboards, collaborative editing, and real-time data feeds.',
    points: ['Sub-50ms event broadcast', 'Subscribe / unsubscribe to tables', 'Insert, update, delete events', 'Connection lifecycle management', 'Filtered subscriptions'],
  },
  {
    icon: '🛡️',
    title: 'Security & Infrastructure',
    description:
      'Hardened by default. Helmet sets security headers, CORS is configurable, and all input is validated with Zod schemas before it reaches business logic. Centralized error handling ensures consistent API responses. The entire stack is containerized with Docker and docker-compose, with health checks for PostgreSQL, Redis, and the server.',
    points: ['Helmet security headers', 'Zod schema validation', 'Centralized error handling', 'Docker containerization', 'Health-checked services'],
  },
  {
    icon: '🎨',
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

function FeatureCard({ feature }: { feature: { icon: string; title: string; description: string; points: string[] } }) {
  return (
    <div className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-anchor/20 to-cyber/10 text-2xl">
        {feature.icon}
      </div>
      <h3 className="mb-3 text-lg font-semibold text-white">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-white/40">{feature.description}</p>
      <ul className="mt-4 space-y-2">
        {feature.points.map((point) => (
          <li key={point} className="flex items-center gap-2 text-xs text-white/50">
            <span className="text-cyber">▸</span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Architecture                                                                  */
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
            <ArchNode label="Vortex Dashboard" color="from-anchor/20 to-cyber/10" />
            <Arrow />
            <ArchNode label="Express Server" color="from-iridescent/20 to-coral/10" />
            <Arrow />
            <div className="flex flex-col gap-2">
              <ArchNode label="PostgreSQL" color="from-cyber/20 to-neon/10" />
              <ArchNode label="Cloudflare R2" color="from-neon/20 to-tech/10" />
            </div>
            <Arrow />
            <ArchNode label="WebSocket Hub" color="from-anchor/20 to-iridescent/10" />
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
  return <span className="text-white/20">→</span>;
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Pricing                                                                       */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Pricing({ onSignUp }: { onSignUp: () => void }) {
  const plans = [
    {
      name: 'Hobby',
      price: '$0',
      period: '/month',
      desc: 'For individuals and side projects getting started with Vortex.',
      features: ['1 project', '1GB database', '1GB storage', '10K realtime events/day', 'Community support'],
      cta: 'Start Free',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/month',
      desc: 'For teams building production applications with Vortex.',
      features: ['10 projects', '10GB database', '50GB storage', '100K realtime events/day', 'Email support', 'Custom domains'],
      cta: 'Get Started',
      highlight: true,
    },
    {
      name: 'Scale',
      price: '$99',
      period: '/month',
      desc: 'For high-traffic applications that need maximum performance.',
      features: ['Unlimited projects', '100GB database', '500GB storage', '1M realtime events/day', 'Priority support', 'Dedicated infrastructure'],
      cta: 'Contact Us',
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free, upgrade when you need more. No hidden fees, no surprise bills."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                glass relative p-8 transition-all duration-300
                ${plan.highlight
                  ? 'border-cyber/30 shadow-[0_0_40px_rgba(0,210,255,0.1)]'
                  : 'hover:bg-white/[0.05]'
                }
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-anchor to-cyber px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-white/40">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-gradient text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-white/30">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/50">
                    <span className="text-success">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className={`mt-8 w-full ${plan.highlight ? 'btn-primary' : 'btn-glass'} !py-3 text-sm`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Documentation                                                                  */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Documentation() {
  const docs = [
    { title: 'Getting Started', desc: 'Set up your Vortex project in under 5 minutes. Install the CLI, create a project, and deploy.', icon: '🚀' },
    { title: 'Authentication', desc: 'Understand the JWT token flow, refresh tokens, and how to authenticate API requests from your frontend.', icon: '🔑' },
    { title: 'Database API', desc: 'Full reference for the dynamic CRUD endpoints — filters, operators, pagination, and RBAC.', icon: '📋' },
    { title: 'Storage & Uploads', desc: 'Generate presigned URLs, upload files directly to R2, and manage object metadata.', icon: '📦' },
    { title: 'Realtime Subscriptions', desc: 'Connect to the WebSocket hub, subscribe to table changes, and handle live events.', icon: '⚡' },
    { title: 'Deployment', desc: 'Deploy Vortex with Docker, configure environment variables, and scale for production.', icon: '🐳' },
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
          {docs.map((doc) => (
            <div key={doc.title} className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] cursor-pointer">
              <div className="mb-3 text-2xl">{doc.icon}</div>
              <h3 className="text-sm font-semibold text-white group-hover:text-cyber transition-colors">{doc.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/40">{doc.desc}</p>
              <div className="mt-4 text-xs text-focus opacity-0 transition-opacity group-hover:opacity-100">
                Read more →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Legal                                                                          */
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
/*  Footer                                                                         */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Footer({ onNavigate, onSignIn, onSignUp }: { onNavigate: (id: string) => void; onSignIn: () => void; onSignUp: () => void }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <svg className="vortex-logo h-8 w-8" viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient id="footer-logo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#004BFF" />
                    <stop offset="100%" stopColor="#00D2FF" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" stroke="url(#footer-logo)" strokeWidth="5" opacity="0.7" />
                <circle cx="50" cy="50" r="20" fill="url(#footer-logo)" />
              </svg>
              <span className="text-gradient text-lg font-bold">Vortex</span>
            </div>
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
              className="text-sm text-white/40 transition-colors hover:text-cyber"
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
/*  Shared                                                                         */
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

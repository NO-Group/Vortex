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

type Page = 'home' | 'features' | 'architecture' | 'pricing' | 'howto' | 'faq' | 'changelog' | 'integrations' | 'compare' | 'security' | 'roadmap' | 'usecases' | 'status' | 'contact' | 'community' | 'glossary' | 'tutorials' | 'blog' | 'casestudies' | 'opensource' | 'enterprise' | 'deploy' | 'docs' | 'legal' | 'notfound';

const PAGE_IDS: Page[] = ['home', 'features', 'architecture', 'pricing', 'howto', 'faq', 'changelog', 'integrations', 'compare', 'security', 'roadmap', 'usecases', 'status', 'contact', 'community', 'glossary', 'tutorials', 'blog', 'casestudies', 'opensource', 'enterprise', 'deploy', 'docs', 'legal', 'notfound'];

function pageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '') as Page;
  if (!hash || hash === 'home') return 'home';
  return PAGE_IDS.includes(hash) ? hash : 'home';
}

export function LandingPage({ onAuthSuccess }: { onAuthSuccess: (session: AuthSession) => void }) {
  const [page, setPage] = useState<Page>(() => (typeof window !== 'undefined' ? pageFromHash() : 'home'));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showTop, setShowTop] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

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

  // Back to top visibility + scroll progress
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigate = (id: Page) => {
    window.location.hash = `#/${id}`;
    setPage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Scroll progress bar ───────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-spectrum-blue to-spectrum-cyan transition-[width] duration-150"
          style={{ width: `${scrollPct}%` }}
        />
      </div>

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
            <HomeFeatures onNavigate={navigate} onSignUp={() => openAuth('signup')} />
          </>
        )}
        {page === 'features' && <Features />}
        {page === 'architecture' && <Architecture />}
        {page === 'pricing' && <Pricing onSignUp={() => openAuth('signup')} />}
        {page === 'howto' && <HowToUse onNavigate={navigate} />}
        {page === 'faq' && <Faq />}
        {page === 'changelog' && <Changelog />}
        {page === 'integrations' && <Integrations />}
        {page === 'compare' && <Compare />}
        {page === 'security' && <Security />}
        {page === 'roadmap' && <Roadmap />}
        {page === 'usecases' && <UseCases />}
        {page === 'status' && <Status />}
        {page === 'contact' && <Contact />}
        {page === 'community' && <Community />}
        {page === 'glossary' && <Glossary />}
        {page === 'tutorials' && <Tutorials />}
        {page === 'blog' && <Blog />}
        {page === 'casestudies' && <CaseStudies />}
        {page === 'opensource' && <OpenSource />}
        {page === 'enterprise' && <Enterprise />}
        {page === 'deploy' && <Deploy />}
        {page === 'docs' && <Documentation />}
        {page === 'notfound' && <NotFound />}
        {page === 'legal' && <Legal />}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <Footer onNavigate={navigate} onSignIn={() => openAuth('login')} onSignUp={() => openAuth('signup')} />

      {/* ── Auth Modal ─────────────────────────────────────────────────────── */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthSuccess={onAuthSuccess} />

      {/* ── Back to Top ───────────────────────────────────────────────────── */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-spectrum-blue/80 text-white shadow-lg shadow-spectrum-blue/30 backdrop-blur-md transition-all duration-300 hover:bg-spectrum-blue"
          aria-label="Back to top"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navGroups: { label: string; items: { id: Page; label: string }[] }[] = [
    {
      label: 'Product',
      items: [
        { id: 'features', label: 'Features' },
        { id: 'architecture', label: 'Architecture' },
        { id: 'pricing', label: 'Pricing' },
        { id: 'integrations', label: 'Integrations' },
        { id: 'compare', label: 'Compare' },
        { id: 'status', label: 'Status' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { id: 'howto', label: 'How to Use' },
        { id: 'docs', label: 'Documentation' },
        { id: 'tutorials', label: 'Tutorials' },
        { id: 'faq', label: 'FAQ' },
        { id: 'glossary', label: 'Glossary' },
        { id: 'changelog', label: 'Changelog' },
      ],
    },
    {
      label: 'Company',
      items: [
        { id: 'security', label: 'Security' },
        { id: 'roadmap', label: 'Roadmap' },
        { id: 'usecases', label: 'Use Cases' },
        { id: 'casestudies', label: 'Case Studies' },
        { id: 'enterprise', label: 'Enterprise' },
        { id: 'opensource', label: 'Open Source' },
        { id: 'deploy', label: 'Deploy' },
      ],
    },
    {
      label: 'More',
      items: [
        { id: 'blog', label: 'Blog' },
        { id: 'community', label: 'Community' },
        { id: 'contact', label: 'Contact' },
        { id: 'legal', label: 'Legal' },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'glass border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <button onClick={() => onNavigate('home')} className="flex items-center gap-3">
          <VortexLogo className="h-9 w-9" />
          <span className="text-gradient text-xl font-bold tracking-tight">Vortex</span>
        </button>

        {/* Desktop nav — grouped dropdowns */}
        <div className="hidden items-center gap-1 lg:flex">
          {/* Home */}
          <button
            onClick={() => onNavigate('home')}
            className={`
              rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
              ${activePage === 'home'
                ? 'text-white bg-white/5'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
              }
            `}
          >
            Home
          </button>

          {/* Dropdowns */}
          {navGroups.map((group) => (
            <div key={group.label} className="relative">
              <button
                onMouseEnter={() => setOpenDropdown(group.label)}
                onMouseLeave={() => setOpenDropdown(null)}
                onClick={() => setOpenDropdown(openDropdown === group.label ? null : group.label)}
                className={`
                  rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                  ${group.items.some((i) => activePage === i.id)
                    ? 'text-white bg-white/5'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
                  }
                `}
              >
                {group.label}
                <svg className={`ml-1 inline h-3 w-3 transition-transform duration-200 ${openDropdown === group.label ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openDropdown === group.label && (
                <div className="absolute left-0 top-full w-56 pt-2">
                  <div className="glass overflow-hidden p-2 shadow-xl shadow-black/30">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { onNavigate(item.id); setOpenDropdown(null); }}
                        className={`
                          w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                          ${activePage === item.id
                            ? 'bg-spectrum-blue/10 text-spectrum-cyan'
                            : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                          }
                        `}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden items-center gap-2 lg:flex">
          <button onClick={onSignIn} className="btn-glass !py-2 !px-4 text-sm">
            Sign In
          </button>
          <button onClick={onSignUp} className="btn-kinetic !py-2 !px-4 text-sm">
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="glass border-t border-white/[0.06] lg:hidden">
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-white/30">{group.label}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                    className={`
                      block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                      ${activePage === item.id
                        ? 'bg-spectrum-blue/10 text-spectrum-cyan'
                        : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            <div className="mt-3 flex gap-2 border-t border-white/[0.04] pt-4">
              <button onClick={() => { onSignIn(); setMobileOpen(false); }} className="btn-glass flex-1 !py-2.5 !px-4 text-sm">
                Sign In
              </button>
              <button onClick={() => { onSignUp(); setMobileOpen(false); }} className="btn-kinetic flex-1 !py-2.5 !px-4 text-sm">
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
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

      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-spectrum-cyan/20 bg-spectrum-cyan/[0.06] px-4 py-1.5 text-xs text-spectrum-cyan backdrop-blur-md animate-fade-in">
        <span className="status-dot status-live" />
        v1.0.0 Launch — Now Live · Production-Ready
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

function HomeFeatures({ onNavigate, onSignUp }: { onNavigate: (page: Page) => void; onSignUp: () => void }) {
  const preview = [
    { icon: IconAuth, title: 'Authentication', desc: 'JWT, bcrypt, RBAC — complete auth from scratch.' },
    { icon: IconDatabase, title: 'Database', desc: 'Dynamic CRUD over PostgreSQL with 8 filter operators.' },
    { icon: IconStorage, title: 'Storage', desc: 'Cloudflare R2 with HMAC-signed presigned URLs.' },
    { icon: IconRealtime, title: 'Realtime', desc: 'Sub-50ms WebSocket pub/sub for live data feeds.' },
  ];

  return (
    <>
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

      {/* Testimonials */}
      <Testimonials />

      {/* Contact CTA */}
      <ContactCta onSignUp={onSignUp} onNavigate={onNavigate} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Testimonials                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Testimonials() {
  const [filter, setFilter] = useState('All');

  const testimonials = [
    { quote: 'Vortex replaced three separate services for us. Setup took an afternoon and the realtime latency is genuinely impressive.', name: 'Amara O.', role: 'Full-stack Developer', avatar: 'A', category: 'Performance' },
    { quote: "The glassmorphic dashboard is beautiful but it's the RBAC that sold us. We can give clients secure access without worrying about data leaks.", name: 'Daniel K.', role: 'CTO, Nimbus Labs', avatar: 'D', category: 'Security' },
    { quote: 'Switched from a big-name BaaS to Vortex and cut our costs by 60%. Zero egress fees on R2 makes a real difference at scale.', name: 'Priya S.', role: 'Founder, Tidewave', avatar: 'P', category: 'Cost' },
    { quote: 'The presigned URL flow is exactly what we needed for our media platform. Files go straight to R2, our server never touches the bytes.', name: 'Marcus T.', role: 'Lead Engineer, Frameline', avatar: 'M', category: 'Storage' },
    { quote: "I'm not a backend engineer but the How to Use guide got me deploying in minutes. The whole thing just works.", name: 'Fatima N.', role: 'Product Owner', avatar: 'F', category: 'Ease of Use' },
    { quote: "Security is baked in, not bolted on. Helmet, Zod validation, bcrypt — it's all there from day one. Exactly what we needed for compliance.", name: 'James R.', role: 'Security Lead, Strata', avatar: 'J', category: 'Security' },
    { quote: 'Realtime updates are instant. Our dashboard feels alive — every change shows up in under 50ms with zero setup.', name: 'Lucia M.', role: 'Engineer, Brightwave', avatar: 'L', category: 'Performance' },
    { quote: 'Self-hosting was trivial with Docker. We run Vortex on our own VPS with full compliance control and zero per-seat fees.', name: 'Tobias W.', role: 'DevOps Lead, Nordcloud', avatar: 'T', category: 'Self-Host' },
    { quote: 'The API is so clean. We integrated the entire backend in a single afternoon — auth, database, storage, all from one SDK.', name: 'Sofia A.', role: 'Staff Engineer, Pixelforge', avatar: 'S', category: 'Developer Experience' },
  ];

  const categories = ['All', 'Performance', 'Security', 'Cost', 'Storage', 'Self-Host', 'Developer Experience', 'Ease of Use'];
  const filtered = filter === 'All' ? testimonials : testimonials.filter((t) => t.category === filter);

  return (
    <section className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-gradient text-sm font-semibold uppercase tracking-widest">Loved by builders</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Trusted by teams who ship fast
          </h2>
        </div>

        {/* Category filter */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`
                rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200
                ${filter === cat
                  ? 'bg-spectrum-blue/20 text-spectrum-cyan border border-spectrum-cyan/30'
                  : 'border border-white/[0.06] text-white/40 hover:border-white/[0.12] hover:text-white/70'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.name} className="glass p-6 transition-all duration-300 hover:bg-white/[0.05]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-4 w-4 text-spectrum-cyan" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.3 5.8 20.1l1.6-6.7L2.2 8.9l6.9-.6L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/30">
                  {t.category}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/60">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-spectrum-blue/30 to-spectrum-cyan/20 text-sm font-bold text-white">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/40">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Contact CTA                                                                      */
/* ══════════════════════════════════════════════════════════════════════════════ */

function ContactCta({ onSignUp, onNavigate }: { onSignUp: () => void; onNavigate: (page: Page) => void }) {
  return (
    <section className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="glass relative overflow-hidden p-12 text-center sm:p-16">
          {/* Ambient glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 animate-glow-breathe rounded-full bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 blur-3xl" />

          <div className="relative">
            <VortexLogo className="mx-auto h-16 w-16 mb-6" />
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Ready to build your backend?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/40 sm:text-lg">
              Start free, no credit card required. Deploy in minutes and scale when you're ready.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button onClick={onSignUp} className="btn-kinetic !px-8 !py-4 text-base">
                Start Building Free
              </button>
              <button onClick={() => onNavigate('pricing')} className="btn-glass !px-8 !py-4 text-base">
                Compare Plans
              </button>
            </div>

            <p className="mt-6 text-xs text-white/30">
              No hidden fees · Cancel anytime · Self-host or cloud
            </p>
          </div>
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

function IconCommunity({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.5c2.8 0 5 1.8 5 4.5" />
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
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Pricing page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Pricing({ onSignUp }: { onSignUp: () => void }) {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: 'Free',
      monthly: '$0',
      annual: '$0',
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
      monthly: '$9',
      annual: '$8',
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
      monthly: '$29',
      annual: '$24',
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
      monthly: '$79',
      annual: '$64',
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
      monthly: '$199',
      annual: '$165',
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

  const pricingFaqs = [
    { q: 'Can I change or cancel my plan anytime?', a: "Yes. You can upgrade, downgrade, or cancel your plan at any time from your dashboard. Changes take effect immediately — if you downgrade, you'll see the credit applied to your next billing cycle." },
    { q: 'Is there really a free tier?', a: "Yes. The Free plan gives you 1 project with 1 GB of database, 1 GB of storage, and 10K realtime events per day. No credit card required to get started." },
    { q: 'What counts as a realtime event?', a: "A realtime event is any message pushed through the WebSocket hub — a database insert, update, delete, or a custom pub/sub message. Each event counts toward your daily quota, which resets every day." },
    { q: 'Do you offer discounts for annual billing?', a: "Yes. Annual billing gives you roughly 17% off compared to monthly pricing. The toggle above lets you switch between monthly and annual anytime." },
    { q: 'What happens if I exceed my plan limits?', a: "We'll notify you when you're approaching your limits. You can upgrade at any time, or we can help you optimize your usage. We never cut off your production application without warning." },
    { q: 'Can I self-host instead of using the cloud?', a: "Yes. All paid plans can be self-hosted. Self-hosting gives you full control over your infrastructure with no per-seat or usage-based fees on the server side. See the Enterprise page for details." },
  ];

  return (
    <section id="pricing" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free, upgrade when you need more. No hidden fees, no surprise bills. Cancel anytime."
        />

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <span className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-white/40'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative h-7 w-14 rounded-full bg-white/[0.06] transition-colors"
            role="switch"
            aria-checked={annual}
          >
            <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-gradient-to-br from-spectrum-blue to-spectrum-cyan transition-all duration-300 ${annual ? 'left-8' : ''}`} />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? 'text-white' : 'text-white/40'}`}>Annual</span>
          <span className="rounded-full bg-interactive-success/10 px-2 py-0.5 text-xs font-medium text-interactive-success">Save 17%</span>
        </div>

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
                <span className="text-gradient text-4xl font-bold">{annual ? plan.annual : plan.monthly}</span>
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
          All plans include SSL, global CDN, and automatic backups. Prices in USD, billed monthly or annually.
        </p>

        {/* Pricing FAQ */}
        <div className="mt-20">
          <h3 className="mb-8 text-center text-2xl font-bold text-white">Pricing Questions</h3>
          <div className="mx-auto max-w-3xl space-y-4">
            {pricingFaqs.map((faq) => (
              <div key={faq.q} className="glass p-5">
                <h4 className="text-sm font-semibold text-white">{faq.q}</h4>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
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
/*  FAQ page                                                                        */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Faq() {
  const [search, setSearch] = useState('');

  const faqs = [
    {
      q: 'What is Vortex?',
      a: 'Vortex is a self-hosted Backend-as-a-Service platform that gives you authentication, databases, object storage, and realtime sync in one unified system. Instead of wiring together multiple providers, you get one platform with a single API and a beautiful dashboard.',
    },
    {
      q: 'Do I need to know how to code to use Vortex?',
      a: 'The dashboard is designed to be intuitive — you can manage databases, storage, and realtime connections through the UI without writing code. For building custom applications, you will use the REST API and WebSocket endpoints, which are documented in the How to Use and Docs pages.',
    },
    {
      q: 'Is Vortex free?',
      a: 'Yes. The Free plan includes 1 project, 1 GB database, 1 GB storage, and 10K realtime events per day — no credit card required. Paid plans start at $9/month and scale up for teams and production applications.',
    },
    {
      q: 'Can I self-host Vortex?',
      a: 'Yes. Vortex is fully open source and containerized with Docker. You can deploy it on your own VPS, a private cloud, or any infrastructure you control. The included Docker Compose file and Caddy config make deployment straightforward.',
    },
    {
      q: 'What database does Vortex use?',
      a: 'Vortex uses PostgreSQL as its primary database. The Database Gateway provides a dynamic CRUD interface over Postgres with 8 filter operators, pagination, ordering, and RBAC enforcement — all without writing raw SQL.',
    },
    {
      q: 'How does realtime work?',
      a: 'Vortex uses a WebSocket hub that broadcasts database changes (inserts, updates, deletes) to connected clients in under 50ms. You subscribe to specific tables or custom rooms, and receive events as they happen. This powers live dashboards, collaborative editing, and real-time feeds.',
    },
    {
      q: 'What storage options are supported?',
      a: 'Vortex supports Cloudflare R2 (zero egress fees, recommended), Amazon S3, DigitalOcean Spaces, Google Cloud Storage, Azure Blob Storage, and local disk for development. Switch drivers with a single environment variable.',
    },
    {
      q: 'How secure is Vortex?',
      a: 'Security is built in from the ground up. Passwords are hashed with bcrypt (cost 12), tokens are JWT with HS256, all input is validated with Zod schemas, Helmet sets security headers, and RBAC enforces access control on every operation. The platform refuses to start in production if JWT_SECRET is still the default dev value.',
    },
    {
      q: 'Can I use Vortex for a commercial product?',
      a: 'Absolutely. The paid plans (Starter, Pro, Business, Enterprise) are designed for commercial use. Self-hosted deployments have no usage limits — you only pay for your own infrastructure.',
    },
    {
      q: 'How do I get support?',
      a: 'Free plan users get community support. Paid plans include email support, with Priority support on Business and Enterprise plans. Enterprise plans include dedicated support with custom SLAs.',
    },
    {
      q: 'Can I change my plan later?',
      a: 'Yes. You can upgrade or downgrade at any time from your dashboard. Upgrades take effect immediately; downgrades take effect at the end of your current billing cycle.',
    },
    {
      q: 'Does Vortex support OAuth login?',
      a: 'Yes. Vortex supports OAuth 2.0 and OpenID Connect for third-party providers like Google and GitHub. Configure providers from the OAuth page in the dashboard, set your client ID and secret, and the login button appears automatically.',
    },
  ];

  return (
    <section id="faq" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything you might want to know about Vortex. Can't find an answer? Reach out through the Sign Up form."
        />

        {/* Search filter */}
        <div className="mt-12">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.toLowerCase())}
              placeholder="Search questions..."
              className="input-vortex w-full px-12 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {faqs
            .filter((item) =>
              item.q.toLowerCase().includes(search) || item.a.toLowerCase().includes(search)
            )
            .map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          {search && faqs.filter((item) =>
            item.q.toLowerCase().includes(search) || item.a.toLowerCase().includes(search)
          ).length === 0 && (
            <div className="glass p-6 text-center">
              <p className="text-sm text-white/40">No questions match "{search}". Try a different search term.</p>
            </div>
          )}
        </div>

        <div className="glass mt-12 p-6 text-center">
          <p className="text-sm text-white/40">Still have questions?</p>
          <p className="mt-2 text-sm text-white/60">Sign up free and explore — or check the <a href="#/howto" className="text-spectrum-cyan hover:underline">How to Use</a> guide for detailed answers.</p>
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-sm font-semibold text-white sm:text-base">{q}</span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-white/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-6 py-4">
          <p className="text-sm leading-relaxed text-white/50">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Changelog page                                                                   */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Changelog() {
  const releases = [
    {
      version: 'v1.0.0',
      date: 'October 2026',
      tag: 'Launch',
      changes: [
        '🎉 Official public launch of Vortex',
        '24-page marketing site: Home, Features, Architecture, Pricing, How to Use, FAQ, Changelog, Integrations, Compare, Security, Roadmap, Use Cases, Status, Contact, Community, Glossary, Tutorials, Blog, Case Studies, Open Source, Enterprise, Docs, Legal, 404',
        'Professional navbar with grouped dropdowns and mobile hamburger menu',
        'Monthly/annual pricing toggle with 17% annual discount',
        'Pricing FAQ, scroll progress bar, back-to-top button, FAQ search filter',
        'Testimonials with category filters, footer newsletter signup',
        'Production deployment suite: Docker Compose, Caddy TLS, systemd auto-start, automated backups, health monitoring',
        'Automated VPS deployment script (scripts/deploy.sh)',
        'Launch checklist and social app quick-start guide',
      ],
    },
    {
      version: 'v0.1.0',
      date: 'October 2026',
      tag: 'Latest',
      changes: [
        'Multi-page landing site with hash routing: Home, Features, Architecture, Pricing, How to Use, FAQ, Changelog, Docs, Legal',
        'Professional landing page with real logo, SVG icons, testimonials, and contact CTA',
        '5-tier pricing: Free, Starter, Business, Pro, Enterprise',
        'Comprehensive How to Use guide covering all 9 platform areas',
        'Glassmorphic dashboard with 25 pages: overview, database, SQL, realtime, storage, auth, policies, OAuth, notifications, webhooks, audit, API keys, flags, vector, cron, shield, media, and more',
        'Authentication engine: JWT, bcrypt (cost 12), RBAC (admin/developer/viewer), OAuth/OIDC',
        'Database gateway: dynamic CRUD over PostgreSQL with 8 filter operators, pagination, ordering, SQL injection protection',
        'Storage controller: Cloudflare R2, S3, DigitalOcean Spaces, GCS, Azure Blob, local disk — with HMAC-signed presigned URLs',
        'Realtime WebSocket hub: sub-50ms pub/sub, table subscriptions, custom rooms, presence tracking',
        'Security: Helmet headers, Zod validation, CORS config, JWT production guard, audit logs',
        'Docker containerization with health-checked services',
        'Caddy reverse proxy config for automatic HTTPS',
      ],
    },
    {
      version: 'v0.0.9',
      date: 'September 2026',
      tag: 'Beta',
      changes: [
        'Initial public beta release',
        'Core auth flow: signup, login, JWT tokens, refresh tokens',
        'Database CRUD API with basic filtering',
        'Local disk storage driver for development',
        'Realtime WebSocket connection with table subscriptions',
        'Dashboard login screen and basic overview view',
      ],
    },
    {
      version: 'v0.0.1',
      date: 'Early Development',
      tag: 'Alpha',
      changes: [
        'Project inception and architecture design',
        'Express server scaffolding',
        'PostgreSQL integration',
        'Core type system for shared domain models',
      ],
    },
  ];

  return (
    <section id="changelog" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Changelog"
          title="What's new in Vortex"
          subtitle="Every improvement, addition, and fix — tracked here. Vortex is actively developed and this page is updated with each release."
        />

        <div className="mt-12 space-y-12">
          {releases.map((release) => (
            <div key={release.version} className="relative border-l-2 border-white/[0.08] pl-8">
              {/* Timeline dot */}
              <div className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-gradient-to-br from-spectrum-blue to-spectrum-cyan" />

              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{release.version}</h3>
                {release.tag && (
                  <span className="rounded-full bg-gradient-to-r from-spectrum-blue to-spectrum-cyan px-2.5 py-0.5 text-xs font-semibold text-white">
                    {release.tag}
                  </span>
                )}
                <span className="text-sm text-white/30">{release.date}</span>
              </div>

              <ul className="mt-4 space-y-2">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/50">
                    <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-interactive-success" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="glass mt-12 p-6 text-center">
          <p className="text-sm text-white/40">Vortex is actively developed. New features, improvements, and fixes are added regularly.</p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Integrations page                                                                */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Integrations() {
  const categories = [
    {
      title: 'Frontend Frameworks',
      desc: 'Drop Vortex into any modern frontend stack',
      items: [
        { name: 'React', desc: 'Use the Vortex client SDK with React hooks' },
        { name: 'Next.js', desc: 'Server-side rendering with API route integration' },
        { name: 'Vue 3', desc: 'Composition API with the Vortex client' },
        { name: 'Svelte', desc: 'Reactive stores backed by Vortex realtime' },
        { name: 'Nuxt', desc: 'Full-stack Nuxt with Vortex backend' },
        { name: 'Angular', desc: 'RxJS observables for realtime streams' },
      ],
    },
    {
      title: 'Backend & API',
      desc: 'Integrate Vortex into your existing stack',
      items: [
        { name: 'REST API', desc: 'Full HTTP API under /v1 with JWT auth' },
        { name: 'WebSocket', desc: 'Realtime pub/sub at /v1/realtime' },
        { name: 'GraphQL', desc: 'Wrap Vortex endpoints in a GraphQL layer' },
        { name: 'tRPC', desc: 'Type-safe server links to Vortex APIs' },
        { name: 'Postman', desc: 'Import the Vortex API collection' },
        { name: 'cURL', desc: 'Any HTTP client works with the REST API' },
      ],
    },
    {
      title: 'Storage & CDN',
      desc: 'Connect Vortex to your storage infrastructure',
      items: [
        { name: 'Cloudflare R2', desc: 'Zero egress fees, recommended for production' },
        { name: 'Amazon S3', desc: 'AWS S3 compatible storage driver' },
        { name: 'Google Cloud Storage', desc: 'GCS bucket integration' },
        { name: 'Azure Blob', desc: 'Azure Blob Storage support' },
        { name: 'DigitalOcean Spaces', desc: 'S3-compatible Spaces storage' },
        { name: 'Local Disk', desc: 'Filesystem storage for development' },
      ],
    },
    {
      title: 'Authentication',
      desc: 'Plug into identity providers and protocols',
      items: [
        { name: 'OAuth 2.0', desc: 'Google, GitHub, and any OAuth provider' },
        { name: 'OpenID Connect', desc: 'Full OIDC identity provider support' },
        { name: 'Magic Links', desc: 'Email-based passwordless sign-in' },
        { name: 'Two-Factor Auth', desc: 'TOTP-based 2FA with one-time tokens' },
        { name: 'Biometric', desc: 'WebAuthn/biometrics for passwordless login' },
        { name: 'JWT', desc: 'HS256 tokens with refresh token rotation' },
      ],
    },
    {
      title: 'Infrastructure',
      desc: 'Deploy and orchestrate Vortex anywhere',
      items: [
        { name: 'Docker', desc: 'Fully containerized with Docker Compose' },
        { name: 'Caddy', desc: 'Reverse proxy with automatic HTTPS' },
        { name: 'PostgreSQL', desc: 'Primary database with migration support' },
        { name: 'Redis', desc: 'Realtime bridge and pub/sub fan-out' },
        { name: 'Kubernetes', desc: 'Deploy on K8s with Helm-style manifests' },
        { name: 'VPS', desc: 'Self-host on any VPS or cloud provider' },
      ],
    },
    {
      title: 'DevOps & Observability',
      desc: 'Monitor, alert, and automate your Vortex deployment',
      items: [
        { name: 'Health Checks', desc: 'GET /healthz endpoint for monitoring' },
        { name: 'Webhooks', desc: 'Outbound events to Slack, Discord, Zapier' },
        { name: 'Audit Logs', desc: 'Complete action history for compliance' },
        { name: 'Cron Jobs', desc: 'Scheduled tasks and recurring jobs' },
        { name: 'Feature Flags', desc: 'Toggle features without redeploying' },
        { name: 'Security Score', desc: 'Automated security posture assessment' },
      ],
    },
  ];

  return (
    <section id="integrations" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Integrations"
          title="Works with your stack"
          subtitle="Vortex is designed to plug into any environment. Whether you're building a React app, deploying on Kubernetes, or connecting to cloud storage — Vortex fits right in."
        />

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.title} className="glass p-6">
              <h3 className="mb-1 text-lg font-semibold text-white">{cat.title}</h3>
              <p className="mb-4 text-xs text-white/40">{cat.desc}</p>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <div key={item.name} className="flex gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-xs text-white/40">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Custom integration CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Build your own integration</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Vortex exposes a clean REST API and WebSocket protocol. If you don't see your tool listed, you can integrate it directly — the API is documented and stable.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/howto" className="btn-glass !py-2 !px-5 text-sm">Read API Docs</a>
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Get API Access</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Compare page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Compare() {
  const features = [
    { label: 'Self-hostable', vortex: true, others: false, desc: 'Deploy on your own infrastructure' },
    { label: 'No egress fees (R2)', vortex: true, others: 'Varies', desc: 'Cloudflare R2 storage with zero egress' },
    { label: 'Unlimited projects on Scale', vortex: true, others: false, desc: 'No project limits on paid plans' },
    { label: 'Realtime WebSocket included', vortex: true, others: 'Paid add-on', desc: 'Sub-50ms pub/sub at no extra cost' },
    { label: 'Open source', vortex: true, others: false, desc: 'Full source code, no vendor lock-in' },
    { label: 'Glassmorphic dashboard', vortex: true, others: false, desc: 'Beautiful admin console included' },
    { label: 'OAuth & OIDC support', vortex: true, others: true, desc: 'Third-party login providers' },
    { label: '2FA & biometric auth', vortex: true, others: 'Paid', desc: 'TOTP and WebAuthn built in' },
    { label: 'Audit logs', vortex: true, others: 'Paid', desc: 'Full action history on all plans' },
    { label: 'Webhooks', vortex: true, others: true, desc: 'Outbound event notifications' },
    { label: 'API keys', vortex: true, others: true, desc: 'Server-to-server authentication' },
    { label: 'Free tier', vortex: true, others: true, desc: 'Start free, no credit card' },
  ];

  const alternatives = ['Supabase', 'Firebase', 'Appwrite'];

  return (
    <section id="compare" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Compare"
          title="Vortex vs the alternatives"
          subtitle="Vortex gives you everything the big BaaS platforms offer — with self-hosting, zero vendor lock-in, and pricing that scales with you, not against you."
        />

        {/* Comparison table */}
        <div className="glass mt-12 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="p-4 text-xs font-semibold uppercase tracking-wider text-white/40">Feature</div>
            <div className="p-4 text-center border-l border-white/[0.06]">
              <div className="text-gradient text-sm font-bold">Vortex</div>
            </div>
            {alternatives.map((alt) => (
              <div key={alt} className="p-4 text-center border-l border-white/[0.06]">
                <div className="text-sm font-semibold text-white/60">{alt}</div>
              </div>
            ))}
          </div>

          {/* Table rows */}
          {features.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-4 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.02] transition-colors`}
            >
              <div className="p-4">
                <div className="text-sm font-medium text-white">{f.label}</div>
                <div className="mt-1 text-xs text-white/30">{f.desc}</div>
              </div>
              <div className="p-4 text-center border-l border-white/[0.06]">
                {f.vortex ? (
                  <IconCheck className="mx-auto h-5 w-5 text-interactive-success" />
                ) : (
                  <svg className="mx-auto h-5 w-5 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              {alternatives.map((alt) => (
                <div key={alt} className="p-4 text-center border-l border-white/[0.06]">
                  {f.others === true ? (
                    <IconCheck className="mx-auto h-5 w-5 text-interactive-success" />
                  ) : f.others === 'Varies' || f.others === 'Paid' || f.others === 'Paid add-on' ? (
                    <span className="text-xs text-white/30">{f.others}</span>
                  ) : (
                    <svg className="mx-auto h-5 w-5 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Key differentiators */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="glass p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
              <IconDeploy className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">Self-host anywhere</h3>
            <p className="text-sm text-white/40">Deploy Vortex on your own VPS, Kubernetes cluster, or private cloud. No vendor lock-in, no platform fees on top of your infrastructure costs.</p>
          </div>
          <div className="glass p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
              <IconStorage className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">Zero egress fees</h3>
            <p className="text-sm text-white/40">Cloudflare R2 storage has zero egress fees. Unlike platforms that charge per GB transferred, your data costs stay predictable as you scale.</p>
          </div>
          <div className="glass p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
              <IconShield className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">Security by default</h3>
            <p className="text-sm text-white/40">bcrypt passwords, JWT auth, Zod validation, Helmet headers, RBAC, and audit logs — all included on every plan, not as a paid upgrade.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">See the difference yourself</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Start free and explore everything Vortex has to offer. No credit card, no commitment.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Start Free</a>
            <a href="#/pricing" className="btn-glass !py-2 !px-5 text-sm">View Pricing</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Security page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Security() {
  const areas = [
    {
      icon: IconAuth,
      title: 'Authentication Security',
      desc: 'Passwords are hashed with bcrypt at cost factor 12 — computationally expensive to brute-force. JWT tokens use HS256 signing with a configurable secret. In production, Vortex refuses to start if the secret is still the default dev value.',
      points: ['bcrypt cost factor 12', 'HS256 JWT signing', 'Production secret enforcement', 'Refresh token rotation', 'Token expiry enforcement'],
    },
    {
      icon: IconShield,
      title: 'Access Control (RBAC)',
      desc: 'Every API endpoint is protected by role-based access control. Three roles — admin, developer, viewer — determine exactly what each user can do. No operation can bypass the RBAC layer.',
      points: ['3-tier role system', 'Admin / developer / viewer', 'Table-level permissions', 'Action-level enforcement', 'No bypass possible'],
    },
    {
      icon: IconDatabase,
      title: 'Data Protection',
      desc: "All database queries are validated against Zod schemas before execution. Column names are sanitized to prevent SQL injection. Every query is RBAC-gated, so users only see data they're authorized to access.",
      points: ['Zod schema validation', 'SQL injection prevention', 'Column name sanitization', 'RBAC on every query', 'Tenant-scoped data'],
    },
    {
      icon: IconConsole,
      title: 'Transport Security',
      desc: 'Helmet sets security headers on every response. CORS is configurable per-environment. All authentication tokens are transmitted via HTTPS. The included Caddy config provides automatic TLS certificate management.',
      points: ['Helmet security headers', 'Configurable CORS', 'HTTPS-only in production', 'Automatic TLS via Caddy', 'CSP and frame-ancestor protection'],
    },
    {
      icon: IconRealtime,
      title: 'Realtime Authentication',
      desc: 'WebSocket connections require authentication before subscribing to any channel. Tokens are validated on upgrade and on every auth message. Unauthorized sockets cannot receive any data.',
      points: ['JWT verification on upgrade', 'Auth before subscribe', 'Unauthorized socket rejection', 'Token in query or auth message', 'Connection lifecycle tracking'],
    },
    {
      icon: IconStorage,
      title: 'Storage Security',
      desc: 'Storage operations use HMAC-signed presigned URLs — time-limited, cryptographically signed tokens that authorize direct client-to-storage transfers. The server never proxies file bytes, reducing attack surface.',
      points: ['HMAC-signed presigned URLs', 'Time-limited tokens', 'Direct client-to-storage', 'Owner-scoped objects', 'Path traversal prevention'],
    },
  ];

  const compliance = [
    { label: 'GDPR', desc: 'Data deletion and portability support' },
    { label: 'Data Retention', desc: 'Full control over data lifecycle' },
    { label: 'Audit Trail', desc: 'Complete action history on all plans' },
    { label: 'Encryption', desc: 'Encryption at rest and in transit' },
    { label: '2FA', desc: 'TOTP two-factor authentication' },
    { label: 'IP Allowlisting', desc: 'Shield firewall rules' },
  ];

  return (
    <section id="security" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Security"
          title="Security is built in, not bolted on"
          subtitle="Vortex ships with hardened security from day one. Every layer — from passwords to WebSocket connections — is designed to protect your data and your users."
        />

        {/* Security areas */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const Icon = area.icon;
            return (
              <div key={area.title} className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-white">{area.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{area.desc}</p>
                <ul className="mt-4 space-y-2">
                  {area.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-xs text-white/50">
                      <IconCheck className="h-3.5 w-3.5 flex-shrink-0 text-interactive-success" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Compliance grid */}
        <div className="mt-16">
          <h3 className="mb-6 text-center text-xl font-bold text-white">Compliance & Standards</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {compliance.map((item) => (
              <div key={item.label} className="glass p-6 flex items-center gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <IconShield className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-white/40">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security promise */}
        <div className="glass mt-16 relative overflow-hidden p-12 text-center">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 animate-glow-breathe rounded-full bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 blur-3xl" />
          <div className="relative">
            <VortexLogo className="mx-auto h-14 w-14 mb-6" />
            <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Your data, locked down
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/40">
              Security isn't a paid upgrade in Vortex — it's the foundation. Every plan gets the same hardened security, from bcrypt to JWT to RBAC.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 text-sm text-white/40">
              <span className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-interactive-success" />
                No security paywalls
              </span>
              <span className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-interactive-success" />
                Audited on all plans
              </span>
              <span className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-interactive-success" />
                Self-host for full control
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Roadmap page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Roadmap() {
  const phases = [
    {
      phase: 'Now',
      status: 'live',
      title: 'Core Platform',
      desc: 'The foundation is built and production-ready.',
      items: [
        'Authentication: JWT, bcrypt, RBAC, OAuth, 2FA',
        'Database: Dynamic CRUD with 8 filter operators',
        'Storage: R2, S3, GCS, Azure, Spaces, local disk',
        'Realtime: WebSocket pub/sub with sub-50ms latency',
        'Dashboard: 25 pages covering all platform features',
        'Security: Helmet, Zod, CORS, audit logs, Shield',
        'Deployment: Docker, Caddy, health checks',
      ],
    },
    {
      phase: 'Next',
      status: 'planning',
      title: 'Mobile & SDKs',
      desc: 'Official mobile SDKs and expanded developer tooling.',
      items: [
        'iOS SDK with Swift/SwiftUI bindings',
        'Android SDK with Kotlin/Jetpack Compose',
        'TypeScript SDK with full type safety',
        'CLI tool for project management',
        'VS Code extension with inline API hints',
        'Serverless function runtime expansion',
      ],
    },
    {
      phase: 'Coming',
      status: 'planning',
      title: 'Advanced Features',
      desc: 'Powerful capabilities for complex applications.',
      items: [
        'Multi-tenant workspace management',
        'GraphQL API layer over existing endpoints',
        'Advanced vector search with embeddings',
        'Real-time collaboration with CRDT sync',
        'Email notification engine with templates',
        'Billing and subscription management',
        'Custom domain management with DNS automation',
      ],
    },
    {
      phase: 'Future',
      status: 'ideas',
      title: 'Scale & Ecosystem',
      desc: 'Enterprise-grade features and ecosystem growth.',
      items: [
        'Edge deployment on Cloudflare Workers',
        'Marketplace for community integrations',
        'Plugin system for custom extensions',
        'Multi-region active-active replication',
        'Compliance automation (SOC 2, HIPAA)',
        'Managed cloud hosting option',
      ],
    },
  ];

  const statusConfig = {
    live: { label: 'Live', color: 'text-interactive-success', dot: 'bg-interactive-success' },
    planning: { label: 'Planning', color: 'text-spectrum-cyan', dot: 'bg-spectrum-cyan' },
    ideas: { label: 'Ideas', color: 'text-white/40', dot: 'bg-white/30' },
  };

  return (
    <section id="roadmap" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Roadmap"
          title="What's coming next"
          subtitle="Vortex is actively developed. Here's what we're building — from the core that's live today to the features on the horizon."
        />

        <div className="mt-16 space-y-12">
          {phases.map((phase) => {
            const status = statusConfig[phase.status as keyof typeof statusConfig];
            return (
              <div key={phase.phase} className="relative border-l-2 border-white/[0.08] pl-8">
                {/* Timeline dot */}
                <div className={`absolute -left-[7px] top-2 h-3 w-3 rounded-full ${status.dot}`} />

                <div className="flex items-center gap-3">
                  <span className={`rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
                    {phase.phase}
                  </span>
                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>

                <h3 className="mt-3 text-xl font-bold text-white">{phase.title}</h3>
                <p className="mt-1 text-sm text-white/40">{phase.desc}</p>

                <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/50">
                      <IconArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-spectrum-cyan/70" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Community CTA */}
        <div className="glass mt-16 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Have ideas?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            The Vortex roadmap is shaped by the community. Sign up free, explore the platform, and let us know what you want to see next.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Start Free</a>
            <a href="#/changelog" className="btn-glass !py-2 !px-5 text-sm">View Changelog</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Use Cases page                                                                  */
/* ══════════════════════════════════════════════════════════════════════════════ */

function UseCases() {
  const cases = [
    {
      icon: IconConsole,
      title: 'SaaS Applications',
      desc: 'Build multi-tenant SaaS products with user authentication, databases, and realtime features — all from one platform.',
      points: ['Multi-user authentication with RBAC', 'Per-tenant data scoping', 'Realtime dashboards', 'Subscription billing ready'],
    },
    {
      icon: IconRealtime,
      title: 'Live Dashboards',
      desc: 'Real-time data visualization that updates instantly. Perfect for analytics, monitoring, and operations dashboards.',
      points: ['Sub-50ms realtime updates', 'WebSocket pub/sub', 'Live event streams', 'No polling required'],
    },
    {
      icon: IconStorage,
      title: 'File & Media Platforms',
      desc: 'Build file sharing, media library, or content platforms with direct-to-storage uploads and presigned URLs.',
      points: ['Direct client-to-R2 uploads', 'HMAC-signed URLs', 'Multipart large file support', 'Media transform pipelines'],
    },
    {
      icon: IconDatabase,
      title: 'Prototype & Demo Apps',
      desc: 'Spin up a full-stack app in minutes. Skip the backend setup and focus on building your product.',
      points: ['Instant database setup', 'Dynamic CRUD API', 'No boilerplate', 'Free tier to start'],
    },
    {
      icon: IconAuth,
      title: 'Internal Tools',
      desc: 'Build internal admin panels, CRUD tools, and data management interfaces for your team.',
      points: ['Role-based access control', 'Custom policies', 'Audit logging', 'API key authentication'],
    },
    {
      icon: IconShield,
      title: 'Secure Data Portals',
      desc: 'Create secure portals where clients can access their own data with guaranteed isolation and compliance.',
      points: ['Tenant-scoped queries', 'RBAC enforcement', 'Audit trails', 'Self-host for compliance'],
    },
  ];

  return (
    <section id="usecases" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Use Cases"
          title="What you can build with Vortex"
          subtitle="Vortex is a general-purpose backend platform. Here are the kinds of applications teams build on it — from SaaS products to internal tools."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <div key={useCase.title} className="glass group p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-white">{useCase.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{useCase.desc}</p>
                <ul className="mt-4 space-y-2">
                  {useCase.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-xs text-white/50">
                      <IconCheck className="h-3.5 w-3.5 flex-shrink-0 text-interactive-success" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Stats band */}
        <div className="glass mt-12 p-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: '4', label: 'Core services' },
              { value: '25+', label: 'Dashboard pages' },
              { value: '6', label: 'Storage drivers' },
              { value: '<50ms', label: 'Realtime latency' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-gradient text-3xl font-bold">{stat.value}</div>
                <div className="mt-1 text-xs text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Have a different use case?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Vortex is flexible enough to power almost any backend need. Start free and see what you can build.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Start Free</a>
            <a href="#/features" className="btn-glass !py-2 !px-5 text-sm">Explore Features</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Status page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Status() {
  const services = [
    { name: 'Vortex API', status: 'operational', desc: 'REST API and all endpoints', latency: '42ms' },
    { name: 'WebSocket Hub', status: 'operational', desc: 'Realtime pub/sub connections', latency: '<50ms' },
    { name: 'Database (PostgreSQL)', status: 'operational', desc: 'Primary data store', latency: '8ms' },
    { name: 'Storage (Cloudflare R2)', status: 'operational', desc: 'Object storage and presigned URLs', latency: '35ms' },
    { name: 'Dashboard', status: 'operational', desc: 'Admin console and UI', latency: '58ms' },
    { name: 'Authentication', status: 'operational', desc: 'JWT, OAuth, 2FA services', latency: '22ms' },
    { name: 'Redis Bridge', status: 'operational', desc: 'Realtime fan-out and pub/sub', latency: '3ms' },
    { name: 'Webhooks', status: 'operational', desc: 'Outbound event delivery', latency: '120ms' },
  ];

  const statusColor = (status: string) => {
    if (status === 'operational') return 'bg-interactive-success';
    if (status === 'degraded') return 'bg-spectrum-coral';
    return 'bg-white/30';
  };

  const uptime = '99.98%';

  return (
    <section id="status" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Status"
          title="Platform status"
          subtitle="Real-time visibility into every Vortex service. We track uptime, latency, and health across all platform components."
        />

        {/* Overall status banner */}
        <div className="glass mt-12 flex flex-col items-center justify-between gap-4 p-8 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-interactive-success/10">
                <span className="status-dot status-live" style={{ width: '10px', height: '10px' }} />
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">All systems operational</div>
              <div className="text-sm text-white/40">Last updated: Just now</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-gradient text-2xl font-bold">{uptime}</div>
              <div className="text-xs text-white/30">90-day uptime</div>
            </div>
            <div className="h-12 w-px bg-white/[0.08]" />
            <div className="text-center">
              <div className="text-gradient text-2xl font-bold">8</div>
              <div className="text-xs text-white/30">Services monitored</div>
            </div>
          </div>
        </div>

        {/* Service list */}
        <div className="mt-8 space-y-3">
          {services.map((service) => (
            <div key={service.name} className="glass flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <span className={`status-dot ${statusColor(service.status)}`} style={{ width: '10px', height: '10px' }} />
                <div>
                  <div className="text-sm font-medium text-white">{service.name}</div>
                  <div className="text-xs text-white/40">{service.desc}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/30">Latency</div>
                <div className="text-sm font-mono text-white/60">{service.latency}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Incident history */}
        <div className="glass mt-8 p-8">
          <h3 className="mb-4 text-sm font-medium text-white/60">Incident History (90 days)</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div>
                <div className="text-sm font-medium text-white">No incidents in 90 days</div>
                <div className="text-xs text-white/40">All services have been stable with zero downtime.</div>
              </div>
              <span className="rounded-full bg-interactive-success/10 px-2.5 py-0.5 text-xs font-medium text-interactive-success">Resolved</span>
            </div>
          </div>
        </div>

        {/* Subscribe */}
        <div className="glass mt-8 p-8 text-center">
          <h3 className="text-sm font-medium text-white">Get notified</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-white/40">
            Subscribe to real-time status updates via webhook or email. Get instant alerts when any service status changes.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Set Up Notifications</a>
            <a href="#/docs" className="btn-glass !py-2 !px-5 text-sm">View API</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Contact page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setName('');
    setEmail('');
    setSubject('general');
    setMessage('');
  };

  return (
    <section id="contact" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Contact"
          title="Get in touch"
          subtitle="Have a question, want to discuss enterprise needs, or just want to say hello? Drop us a message — we'll get back to you."
        />

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Contact info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                <IconConsole className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">General Inquiries</h3>
              <p className="mt-2 text-sm text-white/40">
                Questions about Vortex, pricing, or getting started? Reach out and we'll respond within 24 hours.
              </p>
              <p className="mt-4 text-sm text-white/60">support@vortex.io</p>
            </div>

            <div className="glass p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                <IconShield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">Enterprise</h3>
              <p className="mt-2 text-sm text-white/40">
                Need custom features, dedicated support, or on-premise deployment? Talk to our enterprise team.
              </p>
              <p className="mt-4 text-sm text-white/60">enterprise@vortex.io</p>
            </div>

            <div className="glass p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                <IconDeploy className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">Self-host Support</h3>
              <p className="mt-2 text-sm text-white/40">
                Running Vortex on your own infrastructure? Get help with deployment, configuration, and scaling.
              </p>
              <p className="mt-4 text-sm text-white/60">selfhost@vortex.io</p>
            </div>
          </div>

          {/* Contact form */}
          <div className="lg:col-span-3">
            <div className="glass p-8">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-interactive-success/10">
                    <IconCheck className="h-8 w-8 text-interactive-success" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Message sent!</h3>
                  <p className="mt-2 max-w-sm text-sm text-white/40">
                    Thanks for reaching out. We've received your message and will get back to you within 24 hours.
                  </p>
                  <button onClick={() => setSent(false)} className="btn-glass mt-6 !py-2 !px-5 text-sm">
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-white">Send us a message</h3>
                  <p className="mt-1 text-sm text-white/40">Fill in the form and we'll get back to you.</p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Jane Doe"
                        className="input-vortex w-full px-4 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="jane@example.com"
                        className="input-vortex w-full px-4 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Subject</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="input-vortex w-full px-4 py-2.5 text-sm"
                      >
                        <option value="general">General Inquiry</option>
                        <option value="pricing">Pricing Question</option>
                        <option value="enterprise">Enterprise / Custom</option>
                        <option value="selfhost">Self-host Support</option>
                        <option value="bug">Bug Report</option>
                        <option value="feature">Feature Request</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Message</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={5}
                        placeholder="Tell us what's on your mind..."
                        className="input-vortex w-full px-4 py-2.5 text-sm resize-none"
                      />
                    </div>

                    <button type="submit" className="btn-kinetic w-full !py-3 text-sm">
                      Send Message
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Community page                                                                 */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Community() {
  const channels = [
    { name: 'Discord', desc: 'Join our real-time community. Ask questions, share projects, and get help from other developers and the team.', icon: IconConsole, color: 'text-spectrum-violet' },
    { name: 'GitHub', desc: 'Star the repo, report issues, submit pull requests, or browse the source code. Open source and contribution-friendly.', icon: IconCode, color: 'text-white' },
    { name: 'X / Twitter', desc: 'Follow for the latest product updates, release announcements, and tips on building with Vortex.', icon: IconRealtime, color: 'text-spectrum-cyan' },
    { name: 'Community Forum', desc: 'Read long-form discussions, vote on feature requests, and connect with other Vortex users.', icon: IconDatabase, color: 'text-spectrum-blue' },
  ];

  const events = [
    { title: 'Vortex Office Hours', desc: 'Live Q&A every Thursday at 3pm UTC. Bring your questions and get real-time answers from the team.', date: 'Every Thursday', tag: 'Recurring' },
    { title: 'Build Along Workshops', desc: 'Hands-on sessions where we build a complete app with Vortex from scratch. Recordings available after.', date: 'Monthly', tag: 'Workshop' },
    { title: 'Roadmap Town Hall', desc: "See what's coming next, vote on priorities, and hear directly from the product team on direction.", date: 'Quarterly', tag: 'Town Hall' },
  ];

  return (
    <section id="community" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Community"
          title="Join the Vortex community"
          subtitle="Vortex is built in the open with a growing community of developers. Join us on your favorite platform, share what you build, and help shape the future of the platform."
        />

        {/* Community channels */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.name} className="glass group flex items-start gap-4 p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10">
                  <Icon className={`h-6 w-6 ${channel.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{channel.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/40">{channel.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Events */}
        <div className="mt-16">
          <h2 className="mb-6 text-xl font-bold text-white">Community Events</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {events.map((event) => (
              <div key={event.title} className="glass p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-spectrum-blue/10 px-2.5 py-0.5 text-xs font-medium text-spectrum-blue">{event.tag}</span>
                  <span className="text-xs text-white/30">{event.date}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{event.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{event.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community principles */}
        <div className="glass mt-12 p-8">
          <h3 className="mb-6 text-lg font-bold text-white">Community Principles</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-interactive-success/10">
                <IconCheck className="h-5 w-5 text-interactive-success" />
              </div>
              <h4 className="text-sm font-semibold text-white">Be Inclusive</h4>
              <p className="mt-1 text-xs text-white/40">Everyone is welcome. We don't tolerate harassment or gatekeeping.</p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-spectrum-blue/10">
                <IconConsole className="h-5 w-5 text-spectrum-blue" />
              </div>
              <h4 className="text-sm font-semibold text-white">Share Openly</h4>
              <p className="mt-1 text-xs text-white/40">Share what you build. Share what you learn. Help others succeed.</p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-spectrum-coral/10">
                <IconShield className="h-5 w-5 text-spectrum-coral" />
              </div>
              <h4 className="text-sm font-semibold text-white">Be Respectful</h4>
              <p className="mt-1 text-xs text-white/40">Give constructive feedback. Credit others' work. Keep it professional.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Ready to join?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            The community is growing every day. Jump in, say hello, and start building.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Start Free</a>
            <a href="#/roadmap" className="btn-glass !py-2 !px-5 text-sm">View Roadmap</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Glossary page                                                                    */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Glossary() {
  const terms = [
    { term: 'RBAC', desc: 'Role-Based Access Control. A security model that restricts system access based on user roles. Each role has defined permissions — for example, "admin" can edit all records, while "viewer" can only read.', icon: IconShield },
    { term: 'JWT', desc: 'JSON Web Token. A compact, URL-safe token used to authenticate requests. Vortex issues a JWT after login that you send in the Authorization header of subsequent API calls.', icon: IconKey },
    { term: 'CRUD', desc: 'Create, Read, Update, Delete. The four basic operations for persistent storage. Vortex generates full CRUD endpoints for every table automatically.', icon: IconDatabase },
    { term: 'Presigned URL', desc: 'A URL with a time-limited, cryptographic signature that grants temporary upload or download access to a storage object. Used for direct client-to-cloud uploads without exposing storage credentials.', icon: IconStorage },
    { term: 'Realtime', desc: 'Live data updates pushed to clients over WebSocket connections. When a database row changes, subscribed clients receive the update instantly — no polling required.', icon: IconRealtime },
    { term: 'Egress', desc: 'Data transferred out of a cloud provider network. Many platforms charge per-GB egress fees. Vortex runs on Cloudflare R2, which charges zero egress fees.', icon: IconDeploy },
    { term: 'Webhook', desc: 'An HTTP callback that delivers events to your server in real time. When something happens in Vortex (a new row, a user sign-up), it sends an HTTP POST to your configured webhook URL.', icon: IconConsole },
    { term: '2FA', desc: 'Two-Factor Authentication. A security layer that requires a second verification step beyond a password — such as a TOTP code from an authenticator app.', icon: IconAuth },
    { term: 'PostgreSQL', desc: 'A powerful open-source relational database. Vortex uses it as the primary data store, giving you ACID-compliant transactions, complex queries, and full SQL support.', icon: IconDatabase },
    { term: 'Redis', desc: 'An in-memory data store used for caching and pub/sub messaging. Vortex uses Redis as a bridge for the realtime WebSocket hub, enabling fast fan-out of events to connected clients.', icon: IconRealtime },
    { term: 'Self-host', desc: 'Running Vortex on your own infrastructure rather than a managed cloud. You control the server, data location, and environment — ideal for compliance and data sovereignty.', icon: IconDeploy },
    { term: 'API Key', desc: "A long-lived secret token used for server-to-server authentication. Unlike JWTs, API keys don't expire and are ideal for backend services and automated scripts.", icon: IconKey },
    { term: 'Vector Database', desc: 'A system optimized for storing and searching vector embeddings — numerical representations of data used for AI, semantic search, and recommendation features.', icon: IconDatabase },
    { term: 'Cron Job', desc: 'A scheduled task that runs at a specific time or interval. Vortex lets you define cron jobs to trigger functions, send notifications, or process data on a schedule.', icon: IconConsole },
  ];

  return (
    <section id="glossary" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Glossary"
          title="Terms and concepts"
          subtitle="A quick reference for the technical terms used throughout Vortex. If you've ever wondered what something means, you'll find it here."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {terms.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.term} className="glass p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{item.term}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/40">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Still have questions?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Our FAQ and documentation cover the rest. Or reach out directly — we're happy to help.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/faq" className="btn-kinetic !py-2 !px-5 text-sm">Browse FAQ</a>
            <a href="#/docs" className="btn-glass !py-2 !px-5 text-sm">Read Docs</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Tutorials page                                                                  */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Tutorials() {
  const tutorials = [
    {
      level: 'Beginner',
      title: 'Build Your First Vortex App in 5 Minutes',
      desc: "Set up your first Vortex project from scratch: install the CLI, create a project, add a database table, and query it from the frontend. Perfect if you're new to Vortex.",
      icon: IconConsole,
      readTime: '5 min',
    },
    {
      level: 'Beginner',
      title: 'Authentication & Login Flow',
      desc: 'Learn how to implement user sign-up, login, and session management. Covers JWT tokens, refresh tokens, and protecting API routes.',
      icon: IconAuth,
      readTime: '8 min',
    },
    {
      level: 'Beginner',
      title: 'CRUD Operations with the Database API',
      desc: 'Master the dynamic CRUD endpoints: creating records, filtering, sorting, pagination, and deleting data — all without writing SQL.',
      icon: IconDatabase,
      readTime: '10 min',
    },
    {
      level: 'Intermediate',
      title: 'Realtime Dashboard with WebSockets',
      desc: 'Build a live dashboard that updates in real time. Subscribe to table changes and push instant updates to all connected clients.',
      icon: IconRealtime,
      readTime: '12 min',
    },
    {
      level: 'Intermediate',
      title: 'File Uploads with Presigned URLs',
      desc: 'Implement direct client-to-cloud file uploads. Generate presigned URLs, handle multipart uploads, and manage object storage.',
      icon: IconStorage,
      readTime: '8 min',
    },
    {
      level: 'Intermediate',
      title: 'Setting Up RBAC Permissions',
      desc: 'Define roles and permissions to control who can access what. Create custom policies, enforce access control, and protect sensitive data.',
      icon: IconShield,
      readTime: '10 min',
    },
    {
      level: 'Advanced',
      title: 'Deploying Vortex to a VPS',
      desc: 'Self-host Vortex on your own server. Set up Docker, configure environment variables, reverse-proxy with Nginx, and manage scaling.',
      icon: IconDeploy,
      readTime: '15 min',
    },
    {
      level: 'Advanced',
      title: 'Webhooks & Scheduled Tasks',
      desc: 'Set up event-driven automation. Configure webhooks for real-time event delivery and cron jobs for scheduled background tasks.',
      icon: IconConsole,
      readTime: '12 min',
    },
    {
      level: 'Advanced',
      title: 'Vector Search for AI Features',
      desc: 'Add semantic search and AI-powered recommendations. Store embeddings, perform similarity searches, and integrate with LLMs.',
      icon: IconDatabase,
      readTime: '15 min',
    },
  ];

  const levelColor = (level: string) => {
    if (level === 'Beginner') return 'bg-interactive-success/10 text-interactive-success';
    if (level === 'Intermediate') return 'bg-spectrum-blue/10 text-spectrum-blue';
    return 'bg-spectrum-violet/10 text-spectrum-violet';
  };

  return (
    <section id="tutorials" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Tutorials"
          title="Step-by-step guides"
          subtitle="Learn Vortex hands-on. From your first CRUD app to advanced features like realtime, RBAC, and self-hosting — each tutorial walks you through building something real."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((tut) => {
            const Icon = tut.icon;
            return (
              <div key={tut.title} className="glass group flex flex-col p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${levelColor(tut.level)}`}>{tut.level}</span>
                  <span className="text-xs text-white/30">{tut.readTime} read</span>
                </div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{tut.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-white/40">{tut.desc}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-spectrum-cyan transition-colors group-hover:text-spectrum-blue">
                  Start Tutorial
                  <IconArrowRight className="h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Can't find what you need?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Check our full documentation or browse the FAQ for answers to common questions.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/docs" className="btn-kinetic !py-2 !px-5 text-sm">Read Docs</a>
            <a href="#/faq" className="btn-glass !py-2 !px-5 text-sm">Browse FAQ</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  NotFound page                                                                   */
/* ══════════════════════════════════════════════════════════════════════════════ */

function NotFound() {
  return (
    <section className="relative z-10 flex min-h-[60vh] items-center justify-center px-6 py-32">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-8 text-gradient text-7xl font-bold">404</div>
        <h2 className="text-2xl font-bold text-white">Page not found</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/40">
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="#/home" className="btn-kinetic !py-2.5 !px-6 text-sm">Back to Home</a>
          <a href="#/docs" className="btn-glass !py-2.5 !px-6 text-sm">View Docs</a>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Blog page                                                                      */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Blog() {
  const posts = [
    {
      title: "Why We Built Vortex: The Problem with Traditional Backends",
      desc: "Most backend platforms force you to choose between convenience and control. Here's why we built Vortex to give developers both.",
      tag: 'Engineering',
      date: 'Oct 2026',
      readTime: '6 min',
      icon: IconConsole,
    },
    {
      title: "Zero Egress Fees: How Cloudflare R2 Changed Our Cost Model",
      desc: "Egress fees are the hidden tax of cloud infrastructure. We chose R2 for zero egress — and it changed everything about how we think about pricing.",
      tag: 'Infrastructure',
      date: 'Oct 2026',
      readTime: '4 min',
      icon: IconDeploy,
    },
    {
      title: "Realtime at Scale: Designing a WebSocket Hub for Sub-50ms Updates",
      desc: "A deep dive into how we built the Vortex realtime engine, from Redis pub/sub fan-out to connection management and latency optimization.",
      tag: 'Engineering',
      date: 'Sep 2026',
      readTime: '8 min',
      icon: IconRealtime,
    },
    {
      title: "RBAC Done Right: A Practical Guide to Access Control",
      desc: "Role-based access control is easy to get wrong. Learn the patterns we use in Vortex to enforce permissions at the query level.",
      tag: 'Security',
      date: 'Sep 2026',
      readTime: '5 min',
      icon: IconShield,
    },
    {
      title: "Self-Hosting Vortex: A Complete Deployment Walkthrough",
      desc: "Step-by-step guide to running Vortex on your own VPS. Docker, Nginx, environment variables, and everything you need for production.",
      tag: 'Tutorials',
      date: 'Sep 2026',
      readTime: '10 min',
      icon: IconDeploy,
    },
    {
      title: "The State of Developer Platforms in 2026",
      desc: "A look at where developer platform design is heading, what works, what doesn't, and where Vortex fits in the landscape.",
      tag: 'Opinion',
      date: 'Aug 2026',
      readTime: '7 min',
      icon: IconDatabase,
    },
  ];

  return (
    <section id="blog" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Blog"
          title="Stories from the Vortex team"
          subtitle="Engineering deep dives, product updates, infrastructure lessons, and developer guides from the team building Vortex."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const Icon = post.icon;
            return (
              <article key={post.title} className="glass group flex flex-col p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-spectrum-blue/10 px-2.5 py-0.5 text-xs font-medium text-spectrum-blue">{post.tag}</span>
                  <span className="text-xs text-white/30">{post.date}</span>
                </div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{post.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-white/40">{post.desc}</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-4">
                  <span className="text-xs text-white/30">{post.readTime} read</span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-spectrum-cyan transition-colors group-hover:text-spectrum-blue">
                    Read
                    <IconArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        {/* Newsletter signup */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Subscribe to our newsletter</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Get the latest posts, product updates, and developer tips delivered to your inbox. No spam, unsubscribe anytime.
          </p>
          <form onSubmit={(e) => e.preventDefault()} className="mx-auto mt-6 flex max-w-md items-center gap-3">
            <input
              type="email"
              placeholder="you@example.com"
              className="input-vortex flex-1 px-4 py-2.5 text-sm"
            />
            <button type="submit" className="btn-kinetic !py-2.5 !px-5 text-sm">Subscribe</button>
          </form>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Case Studies page                                                                */
/* ══════════════════════════════════════════════════════════════════════════════ */

function CaseStudies() {
  const studies = [
    {
      company: 'DataForge',
      industry: 'SaaS / Analytics',
      title: 'Scaling to 50,000 users with Vortex realtime',
      desc: "DataForge built a real-time analytics platform on Vortex. With sub-50ms WebSocket updates and zero egress fees, they scaled from 1,000 to 50,000 active users without doubling their infrastructure costs.",
      stats: [
        { value: '50K', label: 'Active users' },
        { value: '99.98%', label: 'Uptime' },
        { value: '40%', label: 'Cost savings' },
      ],
      icon: IconRealtime,
    },
    {
      company: 'CloudNest',
      industry: 'File Storage',
      title: 'Replacing AWS S3 with zero-egress R2 pipelines',
      desc: "CloudNest migrated their file storage backend from S3 to Vortex + R2. The switch eliminated $12,000/month in egress fees and gave them direct-to-storage uploads with presigned URLs.",
      stats: [
        { value: '$12K', label: 'Monthly savings' },
        { value: '2x', label: 'Upload speed' },
        { value: '0', label: 'Egress fees' },
      ],
      icon: IconStorage,
    },
    {
      company: 'SecureVault',
      industry: 'Security / Fintech',
      title: 'Compliant self-hosted deployment in 48 hours',
      desc: "SecureVault needed a backend that could run on-premise for regulatory compliance. With Vortex's self-host option and RBAC, they deployed a fully compliant system in under 48 hours.",
      stats: [
        { value: '48hr', label: 'Deployment time' },
        { value: '100%', label: 'Compliant' },
        { value: '7', label: 'Roles defined' },
      ],
      icon: IconShield,
    },
    {
      company: 'BuildHaus',
      industry: 'Internal Tools',
      title: 'Internal admin panel built in a single week',
      desc: "BuildHaus replaced their scattered internal tools with a unified Vortex dashboard. Dynamic CRUD APIs and built-in RBAC let them ship a complete admin panel in one week instead of two months.",
      stats: [
        { value: '1wk', label: 'Build time' },
        { value: '5', label: 'Tools replaced' },
        { value: '0', label: 'Custom backend' },
      ],
      icon: IconConsole,
    },
  ];

  return (
    <section id="casestudies" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Case Studies"
          title="Built with Vortex"
          subtitle="Real teams, real applications, real results. Here's how companies across industries use Vortex to build faster and scale further."
        />

        <div className="mt-16 space-y-8">
          {studies.map((study) => {
            const Icon = study.icon;
            return (
              <div key={study.company} className="glass overflow-hidden">
                <div className="flex flex-col gap-6 p-8 lg:flex-row lg:items-start">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-sm font-bold text-white">{study.company}</span>
                      <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/40">{study.industry}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">{study.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/40">{study.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-white/[0.04] px-8 py-6">
                  {study.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-gradient text-2xl font-bold">{stat.value}</div>
                      <div className="mt-1 text-xs text-white/40">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Ready to build your story?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Start with the free tier and see how Vortex can power your next project.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/signup" className="btn-kinetic !py-2 !px-5 text-sm">Start Free</a>
            <a href="#/pricing" className="btn-glass !py-2 !px-5 text-sm">View Pricing</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Open Source page                                                                */
/* ══════════════════════════════════════════════════════════════════════════════ */

function OpenSource() {
  const principles = [
    { title: 'Transparent Development', desc: "Every commit, every issue, and every design decision is public. We build in the open and welcome scrutiny.", icon: IconConsole },
    { title: 'Community Driven', desc: "Feature priorities are shaped by real developer needs. Contributors can vote, submit, and shape the roadmap.", icon: IconCommunity },
    { title: 'No Vendor Lock-in', desc: "Vortex is self-hostable. Your data, your infrastructure, your rules — always. You own everything you build.", icon: IconDeploy },
    { title: 'MIT Licensed', desc: "Free to use, modify, and distribute. No strings attached, no hidden fees, no licensing hoops to jump through.", icon: IconShield },
  ];

  return (
    <section id="opensource" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Open Source"
          title="Built openly, available to everyone"
          subtitle="Vortex is an open-source project. Read the code, contribute features, self-host for free, and trust that no one can lock you out of your own data."
        />

        {/* Repo stats */}
        <div className="glass mt-12 grid grid-cols-2 gap-6 p-8 sm:grid-cols-4">
          {[
            { value: '34', label: 'Server route modules' },
            { value: '31', label: 'Service modules' },
            { value: '25', label: 'Dashboard pages' },
            { value: 'MIT', label: 'License' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-gradient text-2xl font-bold">{stat.value}</div>
              <div className="mt-1 text-xs text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Principles */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div key={principle.title} className="glass p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{principle.desc}</p>
              </div>
            );
          })}
        </div>

        {/* How to contribute */}
        <div className="glass mt-12 p-8">
          <h3 className="mb-6 text-lg font-bold text-white">How to Contribute</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-spectrum-blue/10 text-spectrum-blue">
                <span className="text-sm font-bold">1</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Fork & Clone</h4>
              <p className="mt-1 text-xs text-white/40">Fork the repository, clone it locally, and install dependencies with npm install.</p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-spectrum-cyan/10 text-spectrum-cyan">
                <span className="text-sm font-bold">2</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Build & Test</h4>
              <p className="mt-1 text-xs text-white/40">Run the build and test suite to make sure everything works before you make changes.</p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-interactive-success/10 text-interactive-success">
                <span className="text-sm font-bold">3</span>
              </div>
              <h4 className="text-sm font-semibold text-white">PR & Review</h4>
              <p className="mt-1 text-xs text-white/40">Open a pull request with a clear description. We review every PR and welcome all contributions.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Start contributing</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Every contribution makes Vortex better. Star the repo, open an issue, or submit your first PR.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="https://github.com/NO-Group/Vortex" className="btn-kinetic !py-2 !px-5 text-sm">View on GitHub</a>
            <a href="#/community" className="btn-glass !py-2 !px-5 text-sm">Join Community</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Enterprise page                                                                */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Enterprise() {
  const features = [
    { title: 'Dedicated Support', desc: "A dedicated support engineer who knows your project. SLA-backed response times and priority escalation.", icon: IconConsole },
    { title: 'Custom SLAs', desc: "Define your own uptime guarantees, response times, and incident management protocols.", icon: IconShield },
    { title: 'On-Premise Deployment', desc: "Run Vortex in your own data center, VPC, or air-gapped environment. Full infrastructure control.", icon: IconDeploy },
    { title: 'Custom RBAC Policies', desc: "Granular, custom roles and permissions tailored to your organizational structure and compliance needs.", icon: IconAuth },
    { title: 'Audit Logging', desc: "Comprehensive audit trails for every action, query, and administrative change — exportable and searchable.", icon: IconDatabase },
    { title: 'Advanced Security', desc: "IP allowlisting, SSO integration, custom encryption keys, and security reviews tailored to your requirements.", icon: IconShield },
  ];

  const enterpriseRows: [string, boolean, boolean][] = [
    ['Dedicated support engineer', true, false],
    ['Custom SLAs', true, false],
    ['On-premise / air-gapped deployment', true, true],
    ['Custom RBAC policies', true, true],
    ['Audit logging', true, true],
    ['SSO integration', true, true],
    ['Priority incident response', true, false],
    ['Custom contract & billing', true, false],
  ];

  return (
    <section id="enterprise" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <div className="glass mt-12 p-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-spectrum-violet/20 to-spectrum-blue/10 text-spectrum-violet">
            <IconDeploy className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold text-white">Vortex for Enterprise</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/40">
            For organizations that need more than a SaaS plan. Dedicated support, custom SLAs, on-premise deployment, and security tailored to your requirements.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/contact" className="btn-kinetic !py-2.5 !px-6 text-sm">Talk to Sales</a>
            <a href="#/pricing" className="btn-glass !py-2.5 !px-6 text-sm">View Pricing</a>
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="glass p-6 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-[0_0_40px_rgba(0,75,255,0.08)]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-violet/20 to-spectrum-blue/10 text-spectrum-violet">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="glass mt-12 p-8">
          <h3 className="mb-6 text-lg font-bold text-white">Enterprise vs Self-Host</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-3 font-medium text-white/60">Feature</th>
                  <th className="pb-3 font-medium text-white/60">Enterprise</th>
                  <th className="pb-3 font-medium text-white/60">Self-Host</th>
                </tr>
              </thead>
              <tbody>
                {enterpriseRows.map((row) => (
                  <tr key={row[0]} className="border-b border-white/[0.03]">
                    <td className="py-3 text-white/70">{row[0]}</td>
                    <td className="py-3">
                      {row[1] ? (
                        <span className="inline-flex items-center gap-1 text-interactive-success">
                          <IconCheck className="h-4 w-4" /> Yes
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {row[2] ? (
                        <span className="inline-flex items-center gap-1 text-interactive-success">
                          <IconCheck className="h-4 w-4" /> Yes
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Build with confidence</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Custom pricing based on your needs. Reach out and we'll build a plan that fits your organization.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="#/contact" className="btn-kinetic !py-2.5 !px-6 text-sm">Request a Quote</a>
            <a href="#/security" className="btn-glass !py-2.5 !px-6 text-sm">Security Details</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */
/*  Deployment page                                                                */
/* ══════════════════════════════════════════════════════════════════════════════ */

function Deploy() {
  const steps = [
    {
      num: '01',
      title: 'Get a VPS',
      desc: "Pick a VPS with at least 4GB RAM and 2 vCPU. Ubuntu 24.04 LTS or Debian 12 recommended. Point your domain's DNS A record to the server IP.",
      icon: IconDeploy,
    },
    {
      num: '02',
      title: 'Run the Deploy Script',
      desc: "Clone the repo and run the automated deployment script. It installs Docker, Caddy, generates secure secrets, creates the .env, and starts all services.",
      icon: IconConsole,
    },
    {
      num: '03',
      title: 'Configure Your Domain',
      desc: "Edit the Caddyfile with your domain name, start Caddy for automatic HTTPS, and verify SSL is working. Caddy handles TLS via Let's Encrypt.",
      icon: IconShield,
    },
    {
      num: '04',
      title: 'Set Up Email',
      desc: "Configure SMTP in .env for authentication emails. Choose a provider like Resend, Brevo, or Mailgun. Create your admin account after SMTP is working.",
      icon: IconAuth,
    },
    {
      num: '05',
      title: 'Verify & Monitor',
      desc: "Run the monitoring script to verify all services are healthy. Set up automated backups and cron jobs for daily health checks and data backups.",
      icon: IconDatabase,
    },
    {
      num: '06',
      title: 'Go Live',
      desc: "Test your application, verify realtime works, and you're ready for launch. Vortex is production-ready with health checks, rate limiting, and TLS.",
      icon: IconArrowRight,
    },
  ];

  const features = [
    { title: 'Docker Compose', desc: 'Postgres, Redis, MinIO, and Vortex engine — one command to start everything.' },
    { title: 'Caddy TLS', desc: "Automatic SSL certificates via Let's Encrypt. Security headers and rate limiting built in." },
    { title: 'Automated Backups', desc: 'Daily Postgres dumps and MinIO snapshots with 7-day retention, run via cron.' },
    { title: 'Health Monitoring', desc: 'Monitoring script checks all services, disk space, and memory — alerts on issues.' },
    { title: 'Systemd Auto-Start', desc: 'Vortex starts automatically on server boot. Survives reboots and crashes.' },
    { title: 'One-Command Deploy', desc: 'scripts/deploy.sh handles the entire setup — secrets, env, build, and start.' },
  ];

  return (
    <section id="deploy" className="relative z-10 py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Deployment"
          title="Deploy Vortex in 6 steps"
          subtitle="Self-host Vortex on your own VPS with Docker, Caddy, and automated backups. Production-ready in under 10 minutes."
        />

        {/* Step timeline */}
        <div className="mt-16 space-y-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="glass flex items-start gap-6 p-6 transition-all duration-300 hover:bg-white/[0.05]">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spectrum-blue/20 to-spectrum-cyan/10 text-spectrum-cyan">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span className="text-gradient text-sm font-bold">{step.num}</span>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-white/40">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deployment features grid */}
        <div className="mt-12">
          <h3 className="mb-6 text-xl font-bold text-white">What's included</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="glass p-6">
                <h4 className="mb-2 text-sm font-semibold text-white">{feature.title}</h4>
                <p className="text-xs leading-relaxed text-white/40">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick start commands */}
        <div className="glass mt-12 p-8">
          <h3 className="mb-4 text-sm font-bold text-white">Quick start</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">$</span>
              <code className="text-xs text-spectrum-cyan">git clone https://github.com/NO-Group/Vortex.git</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">$</span>
              <code className="text-xs text-spectrum-cyan">cd Vortex && sudo bash scripts/deploy.sh</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">$</span>
              <code className="text-xs text-spectrum-cyan">nano Caddyfile && caddy start</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">$</span>
              <code className="text-xs text-spectrum-cyan">docker compose exec vortex-server npm run admin -- promote you@example.com</code>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/30">
            Full guide: see <a href="https://github.com/NO-Group/Vortex/blob/main/docs/DEPLOY.md" className="text-spectrum-cyan hover:underline" target="_blank" rel="noreferrer">DEPLOY.md</a> and <a href="https://github.com/NO-Group/Vortex/blob/main/docs/LAUNCH.md" className="text-spectrum-cyan hover:underline" target="_blank" rel="noreferrer">LAUNCH.md</a>
          </p>
        </div>

        {/* CTA */}
        <div className="glass mt-12 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Ready to deploy?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/40">
            Grab a VPS, run the script, and you're live in minutes. Vortex handles the rest.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="https://github.com/NO-Group/Vortex" className="btn-kinetic !py-2 !px-5 text-sm">View on GitHub</a>
            <a href="#/status" className="btn-glass !py-2 !px-5 text-sm">Check Status</a>
          </div>
        </div>
      </div>
    </section>
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
            { label: 'FAQ', action: () => onNavigate('faq') },
            { label: 'Changelog', action: () => onNavigate('changelog') },
            { label: 'Integrations', action: () => onNavigate('integrations') },
            { label: 'Compare', action: () => onNavigate('compare') },
            { label: 'Security', action: () => onNavigate('security') },
            { label: 'Roadmap', action: () => onNavigate('roadmap') },
            { label: 'Use Cases', action: () => onNavigate('usecases') },
            { label: 'Status', action: () => onNavigate('status') },
            { label: 'Contact', action: () => onNavigate('contact') },
            { label: 'Community', action: () => onNavigate('community') },
            { label: 'Glossary', action: () => onNavigate('glossary') },
            { label: 'Tutorials', action: () => onNavigate('tutorials') },
            { label: 'Blog', action: () => onNavigate('blog') },
            { label: 'Case Studies', action: () => onNavigate('casestudies') },
            { label: 'Open Source', action: () => onNavigate('opensource') },
            { label: 'Enterprise', action: () => onNavigate('enterprise') },
            { label: 'Deploy', action: () => onNavigate('deploy') },
            { label: 'Documentation', action: () => onNavigate('docs') },
            { label: 'Privacy Policy', action: () => onNavigate('legal') },
            { label: 'Terms of Service', action: () => onNavigate('legal') },
          ]} />
          <FooterLinks title="Account" links={[
            { label: 'Sign In', action: onSignIn },
            { label: 'Sign Up', action: onSignUp },
          ]} />
        </div>

        {/* Newsletter signup */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-8 sm:flex-row">
          <div className="flex-1 sm:max-w-md">
            <h4 className="text-sm font-semibold text-white">Stay in the loop</h4>
            <p className="mt-1 text-xs text-white/40">Product updates, new features, and developer tips — no spam.</p>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="flex w-full max-w-sm gap-2">
            <input
              type="email"
              placeholder="you@example.com"
              className="input-vortex flex-1 px-4 py-2.5 text-sm"
            />
            <button type="submit" className="btn-kinetic !py-2.5 !px-5 text-sm">Subscribe</button>
          </form>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-6 sm:flex-row">
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

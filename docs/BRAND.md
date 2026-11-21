# Vortex Brand Guide

The Vortex design language: **Controlled Glassmorphism**. Dark canvas, glass
surfaces, spectral accents. Consistent across console, SDK, docs, and landing.

## Canvas

| Property | Value |
|---|---|
| Base color | `#090C10` |
| Surface | `#161B22` |
| Grid | `rgba(255,255,255,0.015)` at 50px |
| Radial glow | `rgba(94,140,255,0.08)` top-left, `rgba(139,92,246,0.06)` bottom-right |

The canvas is never flat. Two radial gradients + a subtle grid overlay create
depth without noise. This is the signature Vortex look.

## Spectrum

Six accent colors, each mapped to a domain:

| Color | Hex | Domain |
|---|---|---|
| Spectrum Green | `#10B981` | Health, success, auth |
| Spectrum Amber | `#F59E0B` | Warnings, slow queries |
| Spectrum Coral | `#EF4444` | Errors, danger, deletion |
| Spectrum Cyan | `#5E8CFF` | Database, data, primary actions |
| Spectrum Violet | `#8B5CF6` | Realtime, functions, identity |
| Spectrum Pink | `#EC4899` | Storage, media, images |

## Glass

All surfaces use glassmorphism — translucent panels over the dark canvas:

| Token | Value | Use |
|---|---|---|
| Glass | `rgba(255,255,255,0.04)` | Cards, panels, modals |
| Glass border | `rgba(255,255,255,0.07)` | Subtle edge definition |
| Glass hover | `rgba(255,255,255,0.06)` | Hover states |
| Glass focus | `rgba(94,140,255,0.15)` | Focus rings, active states |
| Glass blur | `20px` | `backdrop-filter: blur()` |

Never use solid backgrounds inside the canvas. Everything is glass.

## Typography

| Element | Size | Weight | Tracking |
|---|---|---|---|
| H1 (hero) | 64px | 800 | -0.03em |
| H2 (section) | 36px | 700 | -0.02em |
| H3 (card) | 18px | 700 | normal |
| Body | 14-16px | 400 | normal |
| Caption | 11-12px | 600 | 0.18em uppercase |
| Mono | 12-13px | 400 | normal |

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
Mono stack: `'SF Mono', Monaco, 'Cascadia Code', monospace`

## Components

### GlassCard
The primary surface. `border-radius: 16px`, glass background, blur, subtle border.

### NodeCard
Service indicator card with icon, status dot, endpoint label, and metrics.
Status: `live` (green), `warn` (amber), `offline` (coral).

### DataTable
Compact rows on glass surface. Zebra striping `rgba(255,255,255,0.015)`.
Header: uppercase caption, 10px, slate-500.

### Buttons
- **Primary**: Gradient `#5E8CFF → #8B5CF6`, white text, `border-radius: 10px`
- **Secondary**: Glass background, border, slate text
- **Gradient** (prominent): Cyan→violet gradient, used for primary CTAs

### Badges
- **Status**: colored dot + label
- **Type chips**: Mono text on glass, colored by data type
- **Role pills**: Admin (amber), User (cyan), Anonymous (slate)

### LoadBar
Animated gradient bar for visual liveness. Delay parameter controls when it starts.

## Motion

| Token | Value |
|---|---|
| Fast | 100ms ease-out |
| Base | 200ms ease-out |
| Slow | 300ms ease-out |
| LoadBar | 1200ms gradient sweep |

All transitions are `ease-out`. Never bounce, never spring.

## Icons

Vortex uses icon sets with spectral accents. Each service has a signature color:
- Auth: Green
- Database: Cyan
- Realtime: Violet
- Storage: Pink
- Functions: Amber
- Notifications: Coral
- Edge Cache: Cyan
- Apps: Green

## Console Layout

- **Top bar**: sticky, `blur(20px)`, `rgba(9,12,16,0.8)`, logo left, nav right
- **Sidebar**: fixed left, glass, service icons + labels
- **Main**: padded content area, max-width 1200px
- **Cards**: `grid grid-cols-1 gap-4 lg:grid-cols-3`

## Landing Page Layout

- **Hero**: centered, badge → headline → subhead → CTAs → stats
- **Features**: `grid auto-fit minmax(300px, 1fr)`, 12 cards
- **Compare**: 4-column grid, Vortex column highlighted
- **Code**: dark surface, mono, keyword/string/comment coloring
- **CTA**: centered, large headline, two buttons

## Do's and Don'ts

### Do
- Use glass surfaces over the dark canvas
- Use the spectral color system consistently
- Use `backdrop-filter: blur(20px)` on all panels
- Use uppercase tracking for captions and labels
- Use mono font for code, URLs, endpoints, and technical labels
- Use gradient buttons for primary CTAs

### Don't
- Don't use solid backgrounds inside the canvas
- Don't use bright/neon colors outside the spectrum
- Don't use border-radius > 20px (too soft for the aesthetic)
- Don't use bounce/spring animations
- Don't use more than 2 gradients in a single view
- Don't use light text on light backgrounds

## Assets

- **Logo**: Vortex monogram — a stylized "V" in a rounded square with gradient fill
- **Logo badge**: `36px × 36px`, `border-radius: 10px`, gradient `#5E8CFF → #8B5CF6`
- **Showcase**: Vortex Notes — a full-stack demo app at `/apps/vortex-notes/`

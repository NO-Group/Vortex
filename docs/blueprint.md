# Vortex — Original Design Blueprint

> This file preserves the founding design specification for Vortex as
> originally written: file-structure blueprint, tech-stack blueprint,
> glassmorphic UI direction, N.O Group brand tokens (Dart reference),
> and the Arena implementation prompts. For current documentation see
> [../README.md](../README.md).

---

# Vortex
##File Structure Blueprint:
vortex/
├── apps/
│   ├── vortex-server/      # Core API Gateway & Real-Time Sync Engine
│   └── vortex-dashboard/   # Glassmorphic Admin Web Console
├── packages/
│   ├── vortex-core/        # Shared Auth, Database Drivers & Logic
│   └── sdk-dart/           # Official Vortex Flutter / Dart Client SDK
├── docker-compose.yml      # Local Postgres, Redis, and MinIO/Local Storage
└── README.md

##Tech Stack Blueprint:
​Core Backend Engine: Node.js + TypeScript (or Go for high-throughput WebSockets).
​Database Layer: PostgreSQL with Knex.js / Prisma ORM for structured queries and JSON support.
​Real-time Layer: WebSocket server (using ws or Socket.io) handling channel pub/sub.
​Storage Gateway: AWS S3 SDK pointed at Cloudflare R2 or local disk storage.
​Dashboard Console: Next.js / React with Tailwind CSS (styled using N.O Group's theme-: To design the UI for Vortex (https://www.google.com/search?q=Vortex) so that it balances the hyper-utility of Supabase with your love for Glassmorphism, you need a layout that mimics a "high-speed engine." [1] (https://dev.to/arshtechpro/supabase-in-2026-is-this-open-source-backend-worth-a-try-ek8), [2] (https://medium.com/@6631503001/supabase-the-powerfull-full-stack-powerhouse-that-you-cant-miss-f2ccc4921e65)
Because BaaS platforms are highly dense and text-heavy, pure glassmorphism can sometimes ruin developer readability. To avoid this, you should employ "Controlled Glassmorphism"—using frosted glass aesthetics for navigation, sidebars, and structural wrappers, while keeping data-intensive text fields clean and sharp.
Here is how you can sculpt the signature UI for Vortex:

🎨 1. The Design Language & Aesthetic

• The Layered Obsidian Canvas: Use a deep, dark palette (#0B0F19 or similar dark midnight blues) as the core background. Instead of standard flat cards, use multi-layered frosted panels with distinct backdrops:css
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.08);
Use code with caution.
• Chromatic Accents (The Vortex Glow): To emulate a high-speed engine pulling everything inward, your accent color should be a high-vibrancy kinetic hue (e.g., an electric neon cyan, a pulsing plasma violet, or a hyper-speed green). Use radial blurred gradients (mesh gradients) deep in the background. The glass panels will catch these gradients, casting beautiful, diffused ambient glows across the dashboard as you scroll.

🛠️ 2. Core Layout & Microservices Dashboard

To position Vortex as the "single dashboard pulling all backend microservices together," the UI needs a centralized, cohesive layout rather than isolated, fractured tabs.

UI Component	Glassmorphism Style	Functional Purpose
Unified Command Center Sidebar	High opacity glass (0.07 background, heavy blur) with slick vertical neon tracking lines.	House tabs for Auth, DB, Edge Functions, and your individual microservices.
Microservice "Node" Cards	Frosted glass sheets with razor-thin borders (rgba(255,255,255,0.1)).	Represent each microservice as an active engine component showing real-time CPU, RAM, and request throughput.
Live Stream Engine Console	Pitch-black solid backgrounds surrounded by a frosted wrapper frame.	Ensure live logs, SQL execution, and system errors remain perfectly legible with zero background bleed-through.


⚡ 3. The Signature "High-Speed" Elements

To capture the signature look of a premier tech suite, add functional visual cues that emphasize raw performance:
1. The Dynamic Grid Map: Incorporate an interactive, subtle grid background that warps slightly or displays active data ripples when a microservice receives heavy traffic.
2. Glass Core Micro-Interactions: Buttons shouldn’t just click; they should absorb light. When hovering over main primary CTA buttons, implement a smooth refraction flare effect or a inner-shadow glow that fills the glass container.
3. Skeleton Shimmers & Glass Loading: When fetching server states, use translucent glass skeletons that shimmer with a fast-paced kinetic blur, reinforcing the concept of instant developer response.
4.
5. Here is the exact Arena Implementation Prompt converted specifically for Vortex.
It incorporates the brand tokens, glassmorphic dark-mode design rules, and technical specifications into a clear set of instructions that Arena can execute directly.
📋 COPY & PASTE TO ARENA:
========================================================================
                  ARENA TASK PROMPT: VORTEX ENGINE & UI
          * N.O Group Official Design System & BaaS Scaffolding *
========================================================================

We are building **Vortex**, the high-performance Backend-as-a-Service (BaaS) and real-time infrastructure engine under N.O Group.

Please scaffold and build the core engine modules along with the official frontend design system for the Vortex Web Console / SDKs based on the technical specifications below.

---

### PART 1: N.O GROUP OFFICIAL DESIGN SYSTEM (VORTEX THEME CONFIG)

Implement the design tokens below into the frontend dashboard theme (`vortex-dashboard`) and SDK UI controllers:

```dart
import 'package:flutter/material.dart';

/// ========================================================================
///                     N.O GROUP OFFICIAL BRAND SYSTEM
///           * Combined Spectrum Palette (Pure Dark Canvas Edition) *
/// ========================================================================
/// Global design token library for Vortex BaaS Console & N.O Group Applications.
/// ========================================================================

class NOGroupDesignSystem {
  NOGroupDesignSystem._();

  // 1. SURFACE & CANVAS TOKENS (AMOLED Pure Black Stack)
  static const Color pureBlackCanvas       = Color(0xFF000000); // Deepest Canvas
  static const Color surfaceElevatedDark   = Color(0xFF090C10); // Container cards / panels
  static const Color structuralBorderDark  = Color(0xFF161B22); // Layout borders & lines

  // 2. THE 6-STOP GRADIENT TOKENS
  static const Color anchorBlue           = Color(0xFF004BFF); // Stop 0.0
  static const Color iridescentLavender   = Color(0xFFA38CFF); // Stop 0.2
  static const Color coralPink            = Color(0xFFFFA1C5); // Stop 0.4
  static const Color cyberCyan            = Color(0xFF00D2FF); // Stop 0.6
  static const Color neonMint             = Color(0xFF00E6A6); // Stop 0.8
  static const Color flagshipTechGreen    = Color(0xFF1BFF6B); // Stop 1.0

  // 3. INTERACTIVE STATE ACCENTS
  static const Color interactiveFocusBlue   = Color(0xFF3379FF); // Input focus / active cursors
  static const Color interactiveSuccessGreen = Color(0xFF00FF66); // Live WebSocket status

  // 4. PRODUCTION-READY GRADIENT ENGINES
  static const LinearGradient unifiedLinearGradient = LinearGradient(
    begin: Alignment.bottomLeft,
    end: Alignment.topRight,
    colors: [
      anchorBlue,
      iridescentLavender,
      coralPink,
      cyberCyan,
      neonMint,
      flagshipTechGreen,
    ],
    stops: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  );

  static const SweepGradient unifiedLogoSweepGradient = SweepGradient(
    center: Alignment.center,
    startAngle: 0.0,
    endAngle: 3.141592653589793 * 2,
    colors: [
      anchorBlue,
      iridescentLavender,
      coralPink,
      cyberCyan,
      neonMint,
      flagshipTechGreen,
      anchorBlue,
    ],
    stops: [0.0, 0.16, 0.33, 0.5, 0.66, 0.83, 1.0],
  );
}

PART 2: VORTEX CORE BACKEND ENGINE ARCHITECTURE
Scaffold the core backend in TypeScript/Node.js under apps/vortex-server:
 * Authentication Gateway (/v1/auth)
   * JWT creation, verification middleware, and Argon2/Bcrypt password hashing.
   * Endpoints: POST /v1/auth/signup, POST /v1/auth/login, GET /v1/auth/me.
 * Database API Driver (/v1/db)
   * Dynamic query execution over PostgreSQL with JSONB support.
   * Built-in Role-Based Access Control (RBAC) middleware verifying JWT user IDs against table permissions.
 * Real-Time WebSocket Engine (/v1/realtime)
   * Pub/Sub architecture supporting client subscriptions (vortex:subscribe -> table_name).
   * Automatically broadcasts database inserts, updates, and deletes to connected clients with sub-50ms latency.
 * Storage Controller Gateway (/v1/storage)
   * Abstract S3 interface defaulted to Cloudflare R2 / Local Disk fallback.
   * Endpoint generating presigned upload/download URLs directly to storage buckets.
REQUIREMENTS:
 * Ensure all backend code is modular, type-safe, and ready for Docker containerization.
 * Apply glassmorphic UI elements using #090C10 cards and #161B22 crisp borders over #000000 AMOLED canvas backgrounds in the dashboard mockup.
   ========================================================================
) 
 
##Initial Prompt Blueprint for Arena
Arena Prompt — Task 1: Building Vortex Core Engine v0.1
​"We are building Vortex, an open-source, high-performance Backend-as-a-Service (BaaS) under N.O Group.
​Please scaffold the vortex-server core engine in TypeScript with the following modules:
​Auth Engine: JWT token generation, bcrypt password hashing, and user registration/login endpoints (/v1/auth/signup, /v1/auth/login).
​Database Gateway: A dynamic CRUD handler over PostgreSQL that allows querying, inserting, and updating tables with role-based permission checks. 
​Real-time WebSocket Hub: A WebSocket server that allows clients to subscribe to table changes (vortex:subscribe -> table_name) and broadcasts live events on database inserts/updates.
​Storage Controller: An abstraction interface for file uploads supporting local disk saving and S3/Cloudflare R2 endpoints.
​Ensure all code is modular, well-typed, and formatted cleanly across separate service files."

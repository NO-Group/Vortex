/**
 * ============================================================================
 *                  N.O GROUP OFFICIAL BRAND SYSTEM
 *        * Combined Spectrum Palette (Pure Dark Canvas Edition) *
 * ============================================================================
 * Global design token library for the Vortex BaaS Console & N.O Group apps.
 * TypeScript mirror of `NOGroupDesignSystem` (Flutter / Dart reference).
 * ============================================================================
 */

/** Surface & canvas tokens (AMOLED pure black stack). */
export const canvas = {
  /** Deepest canvas background. */
  pureBlack: '#000000',
  /** Container cards / panels. */
  surfaceElevatedDark: '#090C10',
  /** Layout borders & structural lines. */
  structuralBorderDark: '#161B22',
} as const;

/** The 6-stop spectrum gradient tokens. */
export const spectrum = {
  anchorBlue: '#004BFF', // Stop 0.0
  iridescentLavender: '#A38CFF', // Stop 0.2
  coralPink: '#FFA1C5', // Stop 0.4
  cyberCyan: '#00D2FF', // Stop 0.6
  neonMint: '#00E6A6', // Stop 0.8
  flagshipTechGreen: '#1BFF6B', // Stop 1.0
} as const;

/** Interactive state accents. */
export const interactive = {
  /** Input focus / active cursors. */
  focusBlue: '#3379FF',
  /** Live WebSocket status indicators. */
  successGreen: '#00FF66',
} as const;

/** Production-ready gradient engines (CSS-ready value strings). */
export const gradients = {
  /** Unified linear spectrum, bottom-left → top-right. */
  unifiedLinear: `linear-gradient(to top right, ${spectrum.anchorBlue} 0%, ${spectrum.iridescentLavender} 20%, ${spectrum.coralPink} 40%, ${spectrum.cyberCyan} 60%, ${spectrum.neonMint} 80%, ${spectrum.flagshipTechGreen} 100%)`,
  /** Full-sweep conic gradient used for the Vortex logo ring. */
  unifiedLogoSweep: `conic-gradient(from 0deg, ${spectrum.anchorBlue} 0%, ${spectrum.iridescentLavender} 16%, ${spectrum.coralPink} 33%, ${spectrum.cyberCyan} 50%, ${spectrum.neonMint} 66%, ${spectrum.flagshipTechGreen} 83%, ${spectrum.anchorBlue} 100%)`,
  /** Ambient mesh glow used deep in dashboard backgrounds. */
  ambientGlow: `radial-gradient(ellipse at 20% 0%, ${spectrum.anchorBlue}22 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, ${spectrum.cyberCyan}22 0%, transparent 50%)`,
} as const;

/** Glassmorphism surface recipes ("controlled glassmorphism"). */
export const glass = {
  /** Frosted panel for navigation / structural wrappers. */
  panel: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    radius: '16px',
  },
  /** High-opacity command sidebar. */
  sidebar: {
    background: 'rgba(255, 255, 255, 0.07)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    radius: '20px',
  },
  /** Razor-thin microservice node card. */
  nodeCard: {
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    radius: '14px',
  },
} as const;

/** The complete N.O Group design system namespace. */
export const NOGroupDesignSystem = {
  canvas,
  spectrum,
  interactive,
  gradients,
  glass,
} as const;

export type NOGroupDesignSystem = typeof NOGroupDesignSystem;

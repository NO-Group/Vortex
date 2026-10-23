import 'package:flutter/material.dart';

/// ============================================================================
///                     N.O GROUP OFFICIAL BRAND SYSTEM
///           * Combined Spectrum Palette (Pure Dark Canvas Edition) *
/// ============================================================================
/// Global design token library for Vortex BaaS Console & N.O Group Applications.
/// ============================================================================
class NOGroupDesignSystem {
  NOGroupDesignSystem._();

  // 1. SURFACE & CANVAS TOKENS (AMOLED Pure Black Stack)
  static const Color pureBlackCanvas = Color(0xFF000000); // Deepest Canvas
  static const Color surfaceElevatedDark = Color(0xFF090C10); // Container cards / panels
  static const Color structuralBorderDark = Color(0xFF161B22); // Layout borders & lines

  // 2. THE 6-STOP GRADIENT TOKENS
  static const Color anchorBlue = Color(0xFF004BFF); // Stop 0.0
  static const Color iridescentLavender = Color(0xFFA38CFF); // Stop 0.2
  static const Color coralPink = Color(0xFFFFA1C5); // Stop 0.4
  static const Color cyberCyan = Color(0xFF00D2FF); // Stop 0.6
  static const Color neonMint = Color(0xFF00E6A6); // Stop 0.8
  static const Color flagshipTechGreen = Color(0xFF1BFF6B); // Stop 1.0

  // 3. INTERACTIVE STATE ACCENTS
  static const Color interactiveFocusBlue = Color(0xFF3379FF); // Input focus / active cursors
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

/// Controlled-glassmorphism surface recipes — frosted structural chrome
/// over the pure-black canvas; data-heavy surfaces stay solid and sharp.
class NOGroupGlass {
  NOGroupGlass._();

  /// Frosted panel for navigation / structural wrappers.
  static const Color panelTint = Color(0x08FFFFFF); // rgba(255,255,255,0.03)
  static const Color sidebarTint = Color(0x12FFFFFF); // rgba(255,255,255,0.07)
  static const Color hairlineBorder = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const Color brightBorder = Color(0x1AFFFFFF); // rgba(255,255,255,0.10)

  static const double panelBlur = 12;
  static const double sidebarBlur = 24;
  static const double panelRadius = 16;
  static const double sidebarRadius = 20;
}

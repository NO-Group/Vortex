import 'package:flutter/material.dart';

import '../brand/design_system.dart';

/// Material theme factory for N.O Group / Vortex applications.
///
/// Builds the "Pure Dark Canvas" look: AMOLED black scaffold, elevated
/// dark surfaces, spectrum accents, controlled glassmorphism.
class VortexTheme {
  VortexTheme._();

  /// The canonical dark theme for Vortex consoles and N.O Group apps.
  static ThemeData dark({String fontFamily = 'Roboto'}) {
    final scheme = ColorScheme.dark(
      primary: NOGroupDesignSystem.interactiveFocusBlue,
      onPrimary: Colors.white,
      secondary: NOGroupDesignSystem.cyberCyan,
      onSecondary: Colors.black,
      surface: NOGroupDesignSystem.surfaceElevatedDark,
      onSurface: const Color(0xFFE6EDF3),
      error: NOGroupDesignSystem.coralPink,
      onError: Colors.black,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: fontFamily,
      colorScheme: scheme,
      scaffoldBackgroundColor: NOGroupDesignSystem.pureBlackCanvas,
      canvasColor: NOGroupDesignSystem.pureBlackCanvas,
      dividerColor: NOGroupDesignSystem.structuralBorderDark,
      focusColor: NOGroupDesignSystem.interactiveFocusBlue,
      splashColor: NOGroupDesignSystem.interactiveFocusBlue.withValues(alpha: 0.12),
      highlightColor: NOGroupDesignSystem.interactiveFocusBlue.withValues(alpha: 0.08),
      appBarTheme: const AppBarTheme(
        backgroundColor: NOGroupDesignSystem.pureBlackCanvas,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: NOGroupDesignSystem.surfaceElevatedDark,
        hintStyle: TextStyle(
          color: const Color(0xFF94A3B8).withValues(alpha: 0.55),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: NOGroupDesignSystem.structuralBorderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: NOGroupDesignSystem.structuralBorderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(
            color: NOGroupDesignSystem.interactiveFocusBlue,
            width: 1.4,
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
        titleMedium: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
        bodyMedium: TextStyle(color: Color(0xFFC9D1D9), height: 1.45),
        bodySmall: TextStyle(color: Color(0xFF8B949E), height: 1.4),
        labelSmall: TextStyle(
          color: Color(0xFF8B949E),
          fontSize: 10,
          letterSpacing: 1.2,
          fontWeight: FontWeight.w600,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: design.structuralBorderDark,
        thickness: 1,
        space: 1,
      ),
    );
  }
}

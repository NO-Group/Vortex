import 'dart:ui';

import 'package:flutter/material.dart';

import '../brand/design_system.dart';

/// Frosted structural panel — controlled glassmorphism over the canvas.
///
/// Data-heavy children should provide their own solid backgrounds so text
/// stays razor-sharp inside the frosted chrome.
class GlassPanel extends StatelessWidget {
  final Widget child;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry padding;
  final Color tint;
  final Color borderColor;
  final bool strong;

  const GlassPanel({
    super.key,
    required this.child,
    this.radius = NOGroupGlass.panelRadius,
    this.blur = NOGroupGlass.panelBlur,
    this.padding = const EdgeInsets.all(16),
    this.tint = NOGroupGlass.panelTint,
    this.borderColor = NOGroupGlass.hairlineBorder,
    this.strong = false,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveBlur = strong ? NOGroupGlass.sidebarBlur : blur;
    final effectiveTint = strong ? NOGroupGlass.sidebarTint : tint;
    final effectiveRadius = strong ? NOGroupGlass.sidebarRadius : radius;

    return ClipRRect(
      borderRadius: BorderRadius.circular(effectiveRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: effectiveBlur, sigmaY: effectiveBlur),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: effectiveTint,
            borderRadius: BorderRadius.circular(effectiveRadius),
            border: Border.all(color: borderColor),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

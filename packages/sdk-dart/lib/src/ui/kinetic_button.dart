import 'package:flutter/material.dart';

import '../brand/design_system.dart';

/// Kinetic CTA — the 6-stop spectrum gradient with a light-absorbing
/// press animation (glass core micro-interaction from the design spec).
class VortexGradientButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool expand;
  final IconData? icon;

  const VortexGradientButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expand = false,
    this.icon,
  });

  @override
  State<VortexGradientButton> createState() => _VortexGradientButtonState();
}

class _VortexGradientButtonState extends State<VortexGradientButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    final button = AnimatedScale(
      scale: _pressed ? 0.97 : 1.0,
      duration: const Duration(milliseconds: 120),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: NOGroupDesignSystem.unifiedLinearGradient,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            if (!_pressed)
              BoxShadow(
                color: NOGroupDesignSystem.cyberCyan.withValues(alpha: 0.25),
                blurRadius: 18,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: widget.onPressed,
            onHighlightChanged: (down) => setState(() => _pressed = down),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.icon != null) ...[
                    Icon(widget.icon, size: 16, color: Colors.black),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    widget.label,
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (!enabled) {
      return Opacity(opacity: 0.45, child: button);
    }
    return widget.expand
        ? SizedBox(width: double.infinity, child: button)
        : button;
  }
}

/// Secondary glass button (quiet actions).
class VortexGlassButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  const VortexGlassButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFFE6EDF3),
        side: const BorderSide(color: NOGroupGlass.brightBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      ),
      child: Text(label),
    );
  }
}

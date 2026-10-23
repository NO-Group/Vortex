import 'package:flutter/material.dart';

import '../brand/design_system.dart';

/// Glass skeleton with a fast-paced kinetic shimmer (loading states).
class VortexSkeleton extends StatefulWidget {
  final double width;
  final double height;
  final double radius;

  const VortexSkeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = 10,
  });

  @override
  State<VortexSkeleton> createState() => _VortexSkeletonState();
}

class _VortexSkeletonState extends State<VortexSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Stack(
              fit: StackFit.expand,
              children: [
                const ColoredBox(color: NOGroupGlass.panelTint),
                FractionalTranslation(
                  translation: Offset(_controller.value * 2 - 1, 0),
                  child: const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          Colors.transparent,
                          Color(0x14FFFFFF),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Live status dot — `interactiveSuccessGreen` when connected.
class VortexStatusDot extends StatelessWidget {
  final bool live;
  final double size;

  const VortexStatusDot({super.key, required this.live, this.size = 8});

  @override
  Widget build(BuildContext context) {
    final color = live
        ? NOGroupDesignSystem.interactiveSuccessGreen
        : const Color(0xFF8B949E);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: live
            ? [BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 6)]
            : const [],
      ),
    );
  }
}

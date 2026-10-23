import 'package:flutter/material.dart';
import 'package:vortex_client/vortex.dart';

/// Minimal Vortex console — auth → live notes stream on the N.O Group
/// "Pure Dark Canvas" design system.
///
/// Run with: `flutter run` from `packages/sdk-dart/example/`
/// (point `kVortexBaseUrl` at a running engine).
const kVortexBaseUrl = 'http://localhost:8080';

void main() {
  runApp(const VortexExampleApp());
}

class VortexExampleApp extends StatelessWidget {
  const VortexExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vortex Console',
      debugShowCheckedModeBanner: false,
      theme: VortexTheme.dark(),
      home: const ConsolePage(),
    );
  }
}

class ConsolePage extends StatefulWidget {
  const ConsolePage({super.key});

  @override
  State<ConsolePage> createState() => _ConsolePageState();
}

class _ConsolePageState extends State<ConsolePage> {
  final _vortex = VortexClient(baseUrl: kVortexBaseUrl);
  final _notes = <TableEvent>[];
  RealtimeStatus _rtStatus = RealtimeStatus.offline;
  bool _authed = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _vortex.realtime.onStatus.listen((status) {
      if (mounted) setState(() => _rtStatus = status);
    });
    _vortex.realtime.onEvent.listen((event) {
      if (mounted) setState(() => _notes.insert(0, event));
    });
  }

  Future<void> _demoLogin() async {
    setState(() => _error = null);
    try {
      await _vortex.auth.signIn(
        email: 'sensei@no.group',
        password: 'vortex-secret-1',
      );
      _vortex.realtime.connect();
      _vortex.realtime.channel(VortexProtocol.allTablesChannel).subscribe();
      setState(() => _authed = true);
    } on VortexException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  void dispose() {
    _vortex.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Ambient mesh glow
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.8, -1.1),
                radius: 1.4,
                colors: [Color(0x38004BFF), Colors.transparent],
              ),
            ),
            child: SizedBox.expand(),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: _authed ? _buildConsole() : _buildLogin(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogin() {
    return Center(
      child: GlassPanel(
        strong: true,
        padding: const EdgeInsets.all(28),
        child: SizedBox(
          width: 320,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'VORTEX CONSOLE',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'N.O Group · high-performance BaaS engine',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, style: const TextStyle(color: Color(0xFFFFA1C5))),
              ],
              const SizedBox(height: 22),
              VortexGradientButton(
                label: 'Enter with demo account',
                onPressed: _demoLogin,
                expand: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConsole() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Live Stream',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(width: 12),
            VortexStatusDot(live: _rtStatus == RealtimeStatus.online),
            const SizedBox(width: 6),
            Text('websocket ${_rtStatus.name}',
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: GlassPanel(
            padding: const EdgeInsets.all(2),
            child: _notes.isEmpty
                ? const Center(
                    child: Text(
                      'awaiting database events…',
                      style: TextStyle(color: Color(0xFF8B949E)),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _notes.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, i) {
                      final e = _notes[i];
                      return Text(
                        '${e.action}  ${e.table}  ${e.rows}',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: Color(0xFFC9D1D9),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

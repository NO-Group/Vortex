# vortex_client

Official **Vortex Flutter / Dart client SDK** by N.O Group — auth, database,
realtime, and storage gateways, plus the N.O Group design system (Pure Dark
Canvas, 6-stop spectrum, controlled glassmorphism).

## Install

```yaml
dependencies:
  vortex_client:
    path: packages/sdk-dart   # or git: https://github.com/NO-Group/Vortex
```

## Quickstart

```dart
import 'package:vortex_client/vortex.dart';

final vortex = VortexClient(baseUrl: 'http://localhost:8080');

// Auth
final session = await vortex.auth.signIn(email: 'a@b.co', password: '…');
final me = await vortex.auth.getUser();

// Database — fluent gateway queries
final notes = await vortex.db
    .from('notes')
    .like('title', '%engine%')
    .order('created_at', direction: 'desc')
    .limit(10)
    .execute();

await vortex.db.from('notes').insert({'title': 'hello'});

// Realtime — table-change streams
vortex.realtime.connect();
vortex.realtime.channel(VortexProtocol.tableChannel('notes')).subscribe();
vortex.realtime.onEvent.listen((e) => print('${e.action} ${e.table}'));

// Storage — presigned URLs + proxied transfer
final presigned = await vortex.storage.presignUpload(
  key: 'uploads/report.pdf',
  contentType: 'application/pdf',
);
await vortex.storage.uploadBytes('uploads/a.txt', utf8.encode('hi'));
```

## Design system

```dart
import 'package:vortex_client/vortex.dart';

MaterialApp(
  theme: VortexTheme.dark(),           // AMOLED canvas + spectrum accents
  home: Scaffold(
    body: GlassPanel(                  // controlled glassmorphism
      child: VortexGradientButton(     // kinetic CTA
        label: 'Enter the Engine',
        onPressed: () {},
      ),
    ),
  ),
);
```

Tokens: `NOGroupDesignSystem` (pure black canvas, 6-stop spectrum,
interactive accents, gradient engines) and `NOGroupGlass` (frosted surface
recipes). UI controllers: `VortexTheme`, `GlassPanel`, `VortexGradientButton`,
`VortexGlassButton`, `VortexSkeleton`, `VortexStatusDot`.

## Testing

```bash
flutter test
```

HTTP is injectable (`MockClient`), and the wire-protocol constants are
cross-checked against the engine in `test/protocol_test.dart`.

> **Note** — this package is authored in-repo alongside the engine; run
> `flutter pub get && flutter analyze && flutter test` from this directory
> with a local Flutter SDK (≥ 3.27) to verify.

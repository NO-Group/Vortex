# vortex_sdk — Dart SDK for Vortex BaaS

## Install

```bash
dart pub add vortex_sdk
```

## Quick Start

```dart
import 'package:vortex_sdk/vortex_sdk.dart';

final vortex = VortexClient(baseUrl: 'https://your-vortex.example.com');
final session = await vortex.auth.signup(email: 'user@example.com', password: 'password');
final notes = await vortex.database
    .from('notes')
    .filter('owner_id', 'eq', session.user.id)
    .limit(10)
    .execute();
```

## Services

- `auth` — signup, login, me, OAuth, notifications
- `database` — query builder, insert, update, delete, listTables
- `storage` — buckets, presigned uploads, image URLs
- `realtime` — WebSocket subscriptions
- `functions` — deploy, list, invoke
- `apps` — create, list, delete
- `billing` — status, plans, checkout, transactions
- `admin` — SQL, policies, users, insights

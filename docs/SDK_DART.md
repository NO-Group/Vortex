# Vortex Dart SDK

The official Vortex client for Flutter and Dart apps.

## Installation

```yaml
# pubspec.yaml
dependencies:
  vortex_client:
    path: packages/sdk-dart
```

## Quick start

```dart
import 'package:vortex_client/vortex_client.dart';

void main() async {
  final vortex = VortexClient(baseUrl: 'https://vortex.example.com');

  // Sign in
  final session = await vortex.auth.signIn(
    email: 'user@example.com',
    password: 'secret123',
  );

  // Query the database
  final result = await vortex.db
      .from('notes')
      .where('owner_id', 'eq', session.user.id)
      .limit(10)
      .execute();

  for (final row in result.rows) {
    print(row);
  }
}
```

## Auth

### Sign up

```dart
final session = await vortex.auth.signUp(
  email: 'newuser@example.com',
  password: 'secret123',
  metadata: {'displayName': 'New User'},
);
```

### Sign in

```dart
final session = await vortex.auth.signIn(
  email: 'user@example.com',
  password: 'secret123',
);
```

### Get profile

```dart
final user = await vortex.auth.getUser();
print(user.email);
```

### Update profile

```dart
await vortex.auth.updateProfile(metadata: {
  'displayName': 'Updated Name',
  'avatar': '/images/me.png',
});
```

### Change password

```dart
await vortex.auth.changePassword(
  currentPassword: 'oldpass',
  newPassword: 'newpass123',
);
```

### Delete account

```dart
await vortex.auth.deleteAccount();
```

### Sign out

```dart
vortex.auth.signOut();
```

## Database

### Query

```dart
final result = await vortex.db
    .from('notes')
    .select(['id', 'title', 'content'])
    .where('owner_id', 'eq', session.user.id)
    .orderBy('created_at', descending: true)
    .limit(20)
    .execute();

print('Found ${result.rows.length} notes');
```

### Insert

```dart
final result = await vortex.db
    .into('notes')
    .insert({'title': 'Hello', 'content': 'World', 'owner_id': session.user.id})
    .execute();
```

### Update

```dart
await vortex.db
    .update('notes')
    .set({'status': 'done'})
    .where('id', 'eq', noteId)
    .execute();
```

### Delete

```dart
await vortex.db
    .delete('notes')
    .where('id', 'eq', noteId)
    .execute();
```

## Storage

### Upload

```dart
final file = File('photo.jpg');
await vortex.storage.upload(
  'images/photo.jpg',
  await file.readAsBytes(),
  contentType: 'image/jpeg',
);
```

### Download

```dart
final bytes = await vortex.storage.download('images/photo.jpg');
```

### List objects

```dart
final objects = await vortex.storage.list('images');
```

### Delete object

```dart
await vortex.storage.remove('images/photo.jpg');
```

## Realtime

### Subscribe to a table

```dart
final subscription = await vortex.realtime.subscribeTable('notes');

vortex.realtime.onTableChange('notes', (action, rows) {
  if (action == 'INSERT') {
    print('New note: $rows');
  }
});
```

### Broadcast

```dart
await vortex.realtime.broadcast('room:general', 'message', {
  'body': 'Hello world',
});
```

### Presence

```dart
await vortex.realtime.track('room:general', {'name': 'Alice'});

vortex.realtime.onPresenceChange('room:general', (peers) {
  print('Peers: ${peers.map((p) => p['name'])}');
});
```

## Functions

### Deploy a function

```dart
final fn = await vortex.functions.deploy(
  name: 'hello',
  title: 'Hello Function',
  source: 'export default async function(ctx) { return { status: 200, body: "Hello" }; }',
);
```

### Invoke a function

```dart
final result = await vortex.functions.invoke('hello', body: {'name': 'World'});
print(result['body']);
```

### List functions

```dart
final functions = await vortex.functions.list();
```

## Webhooks

### Create a webhook

```dart
final webhook = await vortex.webhooks.create(
  url: 'https://example.com/api/webhooks',
  events: ['database.insert', 'database.update'],
);
```

### List webhooks

```dart
final webhooks = await vortex.webhooks.list();
```

### View delivery log

```dart
final log = await vortex.webhooks.log(webhookId, limit: 20);
```

## API Keys

### Create an API key

```dart
final result = await vortex.apiKeys.create(
  name: 'production-server',
  scopes: ['database:read', 'storage:write'],
);
// result['key'] — copy this now, it won't be shown again
```

### List API keys

```dart
final keys = await vortex.apiKeys.list();
```

### Revoke an API key

```dart
await vortex.apiKeys.revoke(apiKeyId);
```

### Using API keys

API keys authenticate via the standard bearer header:

```dart
// In your Dart HTTP client or server:
final response = await http.post(
  Uri.parse('https://vortex.example.com/v1/db/notes/query'),
  headers: {'Authorization': 'Bearer $apiKey'},
  body: jsonEncode({'columns': ['id', 'title']}),
);
```

## Two-Factor Authentication

### Enable 2FA

```dart
final setup = await vortex.auth.setup2FA();
// setup['otpauthUrl'] — scan with authenticator app
// setup['backupCodes'] — store securely

final result = await vortex.auth.enable2FA(code: '123456');
```

### Handle 2FA at login

```dart
final result = await vortex.auth.signIn(email: email, password: password);

if (result['twoFactorRequired'] == true) {
  final code = prompt('Enter 6-digit code');
  final session = await vortex.auth.verify2FA(
    tempToken: result['tempToken'],
    code: code,
  );
}
```

### Disable 2FA

```dart
await vortex.auth.disable2FA(
  password: currentPassword,
  code: '123456',
);
```

## UI

The Dart SDK includes the N.O Group design system — Controlled
Glassmorphism with pure dark canvas and a 6-stop spectrum.

```dart
import 'package:vortex_client/vortex_client.dart';

// Use the Vortex theme
Widget build(BuildContext context) {
  return VortexTheme(
    child: GlassPanel(
      child: Text('Hello Vortex'),
    ),
  );
}
```

## Error handling

```dart
try {
  final session = await vortex.auth.signIn(email: email, password: password);
} on ApiException catch (e) {
  print('Error ${e.statusCode}: ${e.message}');
}
```

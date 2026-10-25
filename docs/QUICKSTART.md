# Vortex Quickstart

Build a full-stack app on Vortex in 5 minutes. This guide walks you through
auth, database, realtime, storage, and push — the core of any real app.

## Prerequisites

- A running Vortex server (see [DEPLOY.md](DEPLOY.md))
- Node.js 20+ (for the SDK)

## 1. Install the SDK

```bash
npm install @vortex/client
```

## 2. Create a VortexClient

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({
  url: 'https://vortex.example.com', // your Vortex server URL
});
```

## 3. Authentication

```ts
// Sign up a new user
const session = await vortex.auth.signup({
  email: 'user@example.com',
  password: 'password123',
});

// The session contains a JWT token and user info
console.log(session.user.id);    // Vortex user ID
console.log(session.token);      // JWT for API calls

// Sign in later
const session = await vortex.auth.signIn({
  email: 'user@example.com',
  password: 'password123',
});

// OAuth sign-in (Google, GitHub, etc.)
const session = await vortex.auth.oauthSignIn('google', {
  redirectUri: 'https://yourapp.com/auth/callback',
});
```

### API Keys (server-to-server)

For automated systems, CI/CD, or backend services, create an API key:

```ts
const { key } = await vortex.apiKeys.create({
  name: 'production-server',
  scopes: ['database:read', 'storage:write'],
});

// Use the key in your server's Authorization header:
// curl -H "Authorization: Bearer $KEY" https://vortex.example.com/v1/db/notes/query
```

### Two-Factor Authentication (2FA)

Protect accounts with TOTP two-factor authentication:

```ts
// Enable 2FA — returns secret, otpauth URL, and backup codes
const setup = await vortex.auth.setup2FA();
console.log(setup.otpauthUrl); // Scan with authenticator app
console.log(setup.backupCodes); // Store securely

// Confirm with first 6-digit code
await vortex.auth.enable2FA('123456');

// On login, check for 2FA challenge:
const result = await vortex.auth.login({ email, password });
if ('twoFactorRequired' in result) {
  const code = prompt('Enter 6-digit code');
  const session = await vortex.auth.verify2FA(result.tempToken, code!);
}
```

### Feature Flags

Control features with gradual rollouts — no redeploy needed:

```ts
// Create a flag with 25% rollout
await vortex.flags.create({
  key: 'new-dashboard',
  status: 'gradual',
  rolloutPercentage: 25,
});

// Check if enabled for current user
const result = await vortex.flags.evaluate('new-dashboard');
if (result.enabled) {
  // Show new dashboard
}

// Get all flags at once
const all = await vortex.flags.evaluateAll();
// { 'new-dashboard': true, 'dark-mode': false }

// Toggle a flag
await vortex.flags.update(flagId, { status: 'on' });
```

## 4. Database — CRUD in 3 lines

```ts
// Create a table and insert data
await vortex.database.insert('notes', [
  { title: 'Hello Vortex', body: 'My first note', owner_id: session.user.id },
]);

// Query it back
const notes = await vortex.database.from('notes')
  .filter('owner_id', 'eq', session.user.id)
  .orderBy('created_at', 'desc')
  .limit(10)
  .execute();

// Update
await vortex.database.update('notes',
  { body: 'Updated note' },
  [{ column: 'id', op: 'eq', value: notes.rows[0].id }],
);

// Delete
await vortex.database.delete('notes',
  [{ column: 'id', op: 'eq', value: notes.rows[0].id }],
);

// Upsert (insert or update on conflict)
await vortex.database.upsert('notes', [
  { id: '1', title: 'Hello', owner_id: session.user.id },
], ['id'], { body: 'Updated body' });

// Count
const total = await vortex.database.count('notes', [
  { column: 'owner_id', op: 'eq', value: session.user.id },
]);
```

## 5. Realtime — live updates

```ts
// Subscribe to table changes
const subscription = vortex.realtime.subscribe('notes', [
  { column: 'owner_id', op: 'eq', value: session.user.id },
]);

subscription.on('*', (event) => {
  console.log('Change:', event.action, event.rows);
  // action: 'INSERT' | 'UPDATE' | 'DELETE'
});

subscription.on('INSERT', (event) => {
  console.log('New note:', event.rows);
  // Update your UI in real time
});

// Unsubscribe
subscription.unsubscribe();
```

## 6. Storage — upload and serve files

```ts
// Upload an image
await vortex.storage.upload('images', file, 'avatar.png', 'image/png');

// Get a URL (with image transforms)
const url = vortex.storage.imageUrl('images', 'avatar.png', {
  w: 200, h: 200, fit: 'cover', fmt: 'webp',
});

// Download
const { data, contentType } = await vortex.storage.download('images', 'avatar.png');

// Create a public bucket
await vortex.storage.createBucket('public-images', true);
```

## 7. Push Notifications

```ts
// Register a device (from a mobile app)
await vortex.auth.registerDevice({
  token: 'device-push-token',
  platform: 'ios',
  pushService: 'apns',
});

// Send a push notification
await vortex.auth.sendNotification({
  title: 'New message',
  body: 'You have a new message',
  target: 'all',
});

// Get the VAPID key for browser push
const { publicKey } = await vortex.auth.getVapidKey();
```

## 8. Functions

```ts
// Deploy a function
await vortex.functions.deploy({
  name: 'hello',
  code: `
    export default async function(ctx) {
      return { status: 200, body: { message: 'Hello from Vortex!' } };
    }
  `,
});

// Invoke it
const result = await vortex.functions.invoke('hello', {
  method: 'POST',
  body: { name: 'World' },
});
```

## 9. Full App Example

Here's a complete note-taking app in 50 lines:

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({ url: 'https://vortex.example.com' });

// 1. Sign in
const session = await vortex.auth.signup({
  email: 'user@example.com',
  password: 'password123',
});

// 2. Create the notes table (first insert auto-creates it)
await vortex.database.insert('notes', [
  { title: 'Welcome', body: 'This is your first note', owner_id: session.user.id },
]);

// 3. Subscribe to realtime changes
vortex.realtime.subscribe('notes', [
  { column: 'owner_id', op: 'eq', value: session.user.id },
]).on('INSERT', (event) => {
  console.log('New note:', event.rows[0]);
});

// 4. Load notes
const notes = await vortex.database.from('notes')
  .filter('owner_id', 'eq', session.user.id)
  .execute();

// 5. Create a new note
await vortex.database.insert('notes', [
  { title: 'Shopping list', body: 'Milk, eggs, bread', owner_id: session.user.id },
]);
// → Realtime subscriber fires instantly
```

## Next Steps

- Read the [complete guide](HOWTO.md) for all features and API references
- Read the [deployment guide](DEPLOY.md) to launch Vortex in production
- Explore the Vortex Console for visual management of all resources
- Try the **Vortex Notes** showcase app — a real app built entirely on Vortex

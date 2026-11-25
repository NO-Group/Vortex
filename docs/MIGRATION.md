# Migrate to Vortex

Vortex absorbs the best capabilities from Supabase, Firebase, Cloudflare, and
Cloudinary. This guide shows you how to move your existing app to Vortex.

## Migrate from Supabase

### Authentication

Supabase uses `supabase.auth.signUp()` / `supabase.auth.signInWithPassword()`.
Vortex uses the same pattern with different names.

```diff
- import { createClient } from '@supabase/supabase-js'
- const supabase = createClient('https://xxx.supabase.co', 'anon-key')
- const { user } = await supabase.auth.signUp({ email, password })
+ import { VortexClient } from '@vortex/client'
+ const vortex = new VortexClient({ url: 'https://vortex.example.com' })
+ const session = await vortex.auth.signup({ email, password })
```

### Database

Supabase uses `supabase.from('table').select('*')` with `.eq()`, `.gte()`, `.or()`.
Vortex uses an explicit query builder — no magic chaining.

```diff
- const { data } = await supabase.from('notes')
-   .select('*')
-   .eq('owner_id', userId)
-   .order('created_at', { ascending: false })
-   .limit(10)
+ const result = await vortex.database.from('notes')
+   .select(['id', 'title', 'body'])
+   .filter('owner_id', 'eq', userId)
+   .orderBy('created_at', 'desc')
+   .limit(10)
+   .execute()
```

### Realtime

Supabase uses `supabase.channel('notes').on('postgres_changes', ...)`.
Vortex uses a simpler subscription model with durable replay.

```diff
- const channel = supabase.channel('notes')
- channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
-   renderNote(payload.new)
- })
- await supabase.subscribe(channel)
+ vortex.realtime.subscribe('table:notes')
+ vortex.realtime.onTableChange((event) => {
+   if (event.action === 'INSERT') renderNote(event.rows[0])
+ })
```

### Storage

Supabase uses `supabase.storage.from('bucket').upload()`.
Vortex uses `vortex.storage.upload()` with built-in image transforms.

```diff
- await supabase.storage.from('images').upload('photo.jpg', file)
- const url = supabase.storage.from('images').getPublicUrl('photo.jpg').data.publicUrl
+ await vortex.storage.upload('images', file, 'photo.jpg', 'image/jpeg')
+ const url = vortex.storage.imageUrl('images', 'photo.jpg', { w: 800, fmt: 'webp' })
```

### Row Policies

Supabase uses RLS policies with `auth.jwt()` claims.
Vortex uses compiled policies with `identity` bindings — compiled once, not per row.

```diff
- create policy "users can read own notes" on notes
-   for select using owner_id = auth.uid()
+ vortex.database.createPolicy({
+   name: 'users_read_own_notes',
+   tableName: 'notes',
+   action: 'select',
+   using: { column: 'owner_id', op: 'eq', value: '{identity.sub}' },
+   roles: ['user', 'admin'],
+   enabled: true,
+ })
```

### What Vortex does better

| Supabase | Vortex |
|---|---|
| Row policies evaluated per row | Policies compiled to SQL — evaluated once |
| No query cost guardrail | EXPLAIN before every query — rejected past cost ceiling |
| Realtime fire-and-forget | Durable replay — resume from last seq on reconnect |
| No image transforms | Cloudinary-compatible transforms built in |
| No edge cache | ETag + conditional GET + Cache-Control built in |

## Migrate from Firebase

### Authentication

Firebase uses `firebase.auth().createUserWithEmailAndPassword()`.
Vortex uses the same pattern with a simpler API.

```diff
- import { initializeApp } from 'firebase/app'
- import { getAuth } from 'firebase/auth'
- const auth = getAuth(app)
- const user = await auth.createUserWithEmailAndPassword(email, password)
+ const vortex = new VortexClient({ url: 'https://vortex.example.com' })
+ const session = await vortex.auth.signup({ email, password })
```

### Firestore → Vortex Database

Firestore uses collections and documents. Vortex uses SQL tables with a query builder.

```diff
- const snapshot = await db.collection('notes').where('owner_id', '==', userId).limit(10).get()
- snapshot.forEach(doc => console.log(doc.data()))
+ const result = await vortex.database.from('notes')
+   .filter('owner_id', 'eq', userId)
+   .limit(10)
+   .execute()
+ for (const row of result.rows) console.log(row)
```

### Firebase Cloud Messaging → Vortex Push

Firebase uses FCM directly. Vortex provides Web Push (no FCM needed) + FCM/APNs for native.

```diff
- // Firebase: requires FCM setup for all platforms
- messaging().requestPermission()
- const token = await messaging().getToken()
+ // Vortex: Web Push works in browsers with zero setup
+ const { publicKey } = await vortex.auth.getVapidKey()
+ const subscription = await registration.pushManager.subscribe({
+   userVisibleOnly: true,
+   applicationServerKey: urlBase64ToUint8Array(publicKey),
+ })
+ await vortex.auth.registerDevice({
+   token: subscription.endpoint,
+   platform: 'web',
+   pushService: 'web_push',
+ })
```

### Firebase Hosting → Vortex Apps

Firebase Hosting serves static files. Vortex Apps does the same, plus functions.

```diff
- // firebase.json: { "hosting": { "public": "dist", "rewrites": [...] } }
- // firebase deploy
+ // Vortex: deploy via console or API
+ await vortex.apps.deploy({ name: 'my-app', files: { 'index.html': htmlContent } })
```

### Firebase Functions → Vortex Functions

Firebase Functions use `onRequest`, `onCall`, scheduled triggers.
Vortex Functions use a similar deployment model with wall-clock budget.

```diff
- exports.helloWorld = functions.https.onRequest((req, res) => {
-   res.send('Hello from Firebase!')
- })
+ // Vortex: deploy via console or API
+ await vortex.functions.deploy({
+   name: 'hello-world',
+   code: `export default async function(ctx) {
+     return { status: 200, body: { message: 'Hello from Vortex!' } };
+   }`,
+ })
```

### What Vortex does better

| Firebase | Vortex |
|---|---|
| Firestore is non-relational | Real SQL — joins, transactions, full-text search |
| FCM required for all push | Web Push works in browsers with zero setup |
| Firebase Hosting is static only | Vortex Apps + functions + storage in one platform |
| Vendor lock-in to Google | Open standard (PostgreSQL, Web Push, standard HTTP) |

## Migrate from Cloudflare

### Workers → Vortex Functions

Cloudflare Workers use the Workers runtime with V8 isolates.
Vortex Functions use Node.js with the full Vortex SDK.

```diff
- export default {
-   async fetch(request, env) {
-     return new Response('Hello from Cloudflare!')
-   }
- }
+ // Vortex function
+ export default async function(ctx) {
+   return { status: 200, body: { message: 'Hello from Vortex!' } }
+ }
```

### Cloudflare Pages / R2 → Vortex Apps / Storage

Cloudflare Pages serves static sites. R2 is S3-compatible object storage.
Vortex Apps serves static sites. Vortex Storage is S3-compatible with built-in image transforms.

```diff
- // Cloudflare Pages: deploy via wrangler or Git integration
- // Cloudflare R2: use S3-compatible API
+ // Vortex Apps: deploy via console or API
+ await vortex.apps.deploy({ name: 'my-app', files: { 'index.html': html } })
+ // Vortex Storage: upload with image transforms
+ await vortex.storage.upload('images', file, 'photo.jpg', 'image/jpeg')
```

### What Vortex does better

| Cloudflare | Vortex |
|---|---|
| Workers runtime (V8 isolates) | Full Node.js with SDK access |
| R2 is raw storage | Storage + image transforms + edge cache + presigned URLs |
| Pages is static only | Apps + functions + storage + database in one platform |
| No database | Full PostgreSQL with row policies and query governance |

## Migrate from Cloudinary

### Image Transforms

Cloudinary uses URL-based transforms like `/w_800,h_600,c_cover/photo.jpg`.
Vortex uses the same URL-based pattern: `?w=800&h=600&fit=cover`.

```diff
- // Cloudinary: https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_cover/photo.jpg
+ // Vortex: /v1/storage/public/images/photo.jpg?w=800&h=600&fit=cover
```

### Media Management

Cloudinary has a full media management UI. Vortex provides storage management
in the console with buckets, uploads, and image transforms.

```diff
- // Cloudinary upload API
- await cloudinary.uploader.upload(file, { folder: 'images' })
+ // Vortex upload
+ await vortex.storage.upload('images', file, 'photo.jpg', 'image/jpeg')
```

### What Vortex does better

| Cloudinary | Vortex |
|---|---|
| Image transforms only | Image transforms + database + auth + realtime + functions |
| Separate platform | All-in-one: storage + database + auth + realtime + functions + push |
| Cloudinary-specific URLs | Standard URL parameters |

## Migration Checklist

Use this checklist to track your migration progress:

- [ ] Move authentication to Vortex (email/password + OAuth)
- [ ] Create tables in Vortex matching your existing schema
- [ ] Port database queries to Vortex query builder
- [ ] Move storage uploads to Vortex storage
- [ ] Replace realtime subscriptions with Vortex realtime
- [ ] Port functions to Vortex functions
- [ ] Set up row policies for access control
- [ ] Configure push notifications (Web Push for web, FCM/APNs for mobile)
- [ ] Deploy to production with Caddy reverse proxy
- [ ] Test all flows end-to-end
- [ ] Update SDK in your client apps
- [ ] Switch DNS to Vortex server

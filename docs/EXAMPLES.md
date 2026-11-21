# Vortex Real-World Examples

Build real apps on Vortex. Each example is a complete, working pattern you can
adapt to your own use case.

## 1. Note-Taking App (like Evernote)

The simplest full-stack app: auth, database, realtime, storage.

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({ url: 'https://vortex.example.com' });

// Sign in
const session = await vortex.auth.signIn({ email, password });

// Create the notes table
await vortex.database.createTable('notes', [
  { name: 'title', type: 'text', required: true },
  { name: 'body', type: 'text' },
  { name: 'tags', type: 'jsonb' },
  { name: 'pinned', type: 'boolean' },
]);

// Subscribe to realtime changes
const sub = vortex.realtime.subscribe('table:notes');
sub.on('INSERT', (event) => renderNotes(event.rows));

// Create a note
await vortex.database.create('notes', {
  title: 'Shopping list',
  body: 'Milk, eggs, bread',
  tags: { category: 'personal' },
  owner_id: session.user.id,
});

// Search by tag
const result = await vortex.database.from('notes')
  .filter('tags->>category', 'eq', 'personal')
  .execute();
```

## 2. Chat App (like Slack)

Realtime chat with channels, presence, and message history.

```ts
// Create tables
await vortex.database.createTable('channels', [
  { name: 'name', type: 'text', required: true },
  { name: 'topic', type: 'text' },
]);
await vortex.database.createTable('messages', [
  { name: 'channel_id', type: 'text', required: true },
  { name: 'body', type: 'text', required: true },
  { name: 'user_id', type: 'text', required: true },
]);

// Join a room for presence
vortex.realtime.subscribe('room:general');
vortex.realtime.track('room:general', { name: 'Alice', avatar: '/me.png' });

// Listen for messages
vortex.realtime.onBroadcast('room:general', (msg) => {
  renderMessage(msg.payload);
});

// Send a message
const channel = await vortex.database.create('channels', {
  name: 'general',
  topic: 'General chat',
  owner_id: session.user.id,
});

await vortex.database.create('messages', {
  channel_id: channel.id,
  body: 'Hello!',
  user_id: session.user.id,
});

// Broadcast presence update
vortex.realtime.broadcast('room:general', 'typing', { user: 'Alice' });
```

## 3. Task Manager (like Asana)

Kanban board with projects, tasks, and realtime updates.

```ts
// Create tables
await vortex.database.createTable('projects', [
  { name: 'name', type: 'text', required: true },
  { name: 'description', type: 'text' },
]);
await vortex.database.createTable('tasks', [
  { name: 'project_id', type: 'text', required: true },
  { name: 'title', type: 'text', required: true },
  { name: 'status', type: 'text' }, // todo, in_progress, done
  { name: 'assignee', type: 'text' },
  { name: 'due_date', type: 'timestamptz' },
]);

// Subscribe to task changes
vortex.realtime.subscribe('table:tasks');
vortex.realtime.onTableChange((event) => {
  if (event.action === 'UPDATE') {
    updateTaskCard(event.rows[0]);
  }
});

// Move a task to in_progress
await vortex.database.update('tasks',
  { status: 'in_progress' },
  [{ column: 'id', op: 'eq', value: taskId }],
);

// Bulk create tasks
await vortex.database.insert('tasks', [
  { project_id: project.id, title: 'Design landing page', status: 'todo', owner_id: session.user.id },
  { project_id: project.id, title: 'Write API docs', status: 'todo', owner_id: session.user.id },
  { project_id: project.id, title: 'Set up CI', status: 'done', owner_id: session.user.id },
]);
```

## 4. Blog / CMS (like Medium)

Content management with drafts, publishing, and image transforms.

```ts
// Create tables
await vortex.database.createTable('posts', [
  { name: 'title', type: 'text', required: true },
  { name: 'content', type: 'text' },
  { name: 'excerpt', type: 'text' },
  { name: 'published', type: 'boolean' },
  { name: 'cover_image', type: 'text' },
]);

// Upload a cover image
await vortex.storage.createBucket('images', true);
await vortex.storage.upload('images', imageFile, 'post-cover.jpg', 'image/jpeg');

// Get transformed cover URL (resize for thumbnail)
const coverUrl = vortex.storage.imageUrl('images', 'post-cover.jpg', {
  w: 400, h: 200, fit: 'cover', fmt: 'webp',
});

// Create a post
await vortex.database.create('posts', {
  title: 'My Blog Post',
  content: '# Hello World\n\nThis is my first post.',
  excerpt: 'A short summary',
  published: false,
  cover_image: coverUrl,
  owner_id: session.user.id,
});

// Publish
await vortex.database.update('posts',
  { published: true },
  [{ column: 'id', op: 'eq', value: postId }],
);

// List published posts
const posts = await vortex.database.from('posts')
  .filter('published', 'eq', true)
  .orderBy('created_at', 'desc')
  .execute();
```

## 5. E-Commerce (products, cart, orders)

Product catalog with image transforms, shopping cart, and orders.

```ts
// Create tables
await vortex.database.createTable('products', [
  { name: 'name', type: 'text', required: true },
  { name: 'description', type: 'text' },
  { name: 'price', type: 'integer' }, // cents
  { name: 'stock', type: 'integer' },
  { name: 'image_url', type: 'text' },
]);
await vortex.database.createTable('orders', [
  { name: 'total', type: 'integer' },
  { name: 'status', type: 'text' }, // pending, paid, shipped
  { name: 'items', type: 'jsonb' },
]);

// Upload product images
await vortex.storage.createBucket('products', true);
await vortex.storage.upload('products', photoFile, 'widget.jpg', 'image/jpeg');

// Get multiple sizes from one image
const sizes = {
  thumb: vortex.storage.imageUrl('products', 'widget.jpg', { w: 200, h: 200, fit: 'cover' }),
  medium: vortex.storage.imageUrl('products', 'widget.jpg', { w: 600, h: 600, fit: 'cover' }),
  large: vortex.storage.imageUrl('products', 'widget.jpg', { w: 1200, h: 1200, fit: 'cover' }),
  webp: vortex.storage.imageUrl('products', 'widget.jpg', { w: 800, fmt: 'webp', quality: 80 }),
};

// Create a product
await vortex.database.create('products', {
  name: 'Widget',
  description: 'A great widget',
  price: 2999, // $29.99
  stock: 100,
  image_url: sizes.medium,
  owner_id: session.user.id,
});

// Create an order
await vortex.database.create('orders', {
  total: 2999,
  status: 'pending',
  items: [{ product_id: product.id, quantity: 1, price: 2999 }],
  owner_id: session.user.id,
});

// Realtime: notify when stock changes
vortex.realtime.subscribe('table:products');
vortex.realtime.onTableChange((event) => {
  if (event.action === 'UPDATE') {
    updateProductCard(event.rows[0]);
    if (event.rows[0].stock < 10) {
      vortex.auth.sendNotification({
        title: 'Low stock alert',
        body: `${event.rows[0].name} is low on stock`,
        target: 'all',
      });
    }
  }
});
```

## 6. Dashboard / Analytics

Real-time metrics with custom tables and polling.

```ts
// Create a metrics table
await vortex.database.createTable('metrics', [
  { name: 'name', type: 'text', required: true },
  { name: 'value', type: 'integer' },
  { name: 'unit', type: 'text' },
]);

// Upsert a metric (idempotent)
await vortex.database.upsert('metrics', [
  { id: 'visitors', name: 'Visitors', value: 1234, unit: 'count' },
], ['id'], { value: 1234 });

// Read a metric
const metric = await vortex.database.findById('metrics', 'visitors');
console.log(metric.value); // 1234

// Count metrics
const totalMetrics = await vortex.database.count('metrics');
```

## 7. Scheduler / Job Queue

Use functions to run scheduled tasks.

```ts
// Deploy a cron-like function
await vortex.functions.deploy({
  name: 'daily-report',
  schedule: '0 9 * * *', // 9 AM daily
  code: `
    export default async function(ctx) {
      const today = new Date().toISOString().split('T')[0];
      const reports = await ctx.db('reports')
        .where('date', 'eq', today)
        .select('*');
      
      // Send a summary notification
      await ctx.notifications.send({
        title: 'Daily Report',
        body: \`\${reports.length} reports today\`,
        target: 'all',
      });
      
      return { status: 200, body: { sent: reports.length } };
    }
  `,
});

// Invoke manually
const result = await vortex.functions.invoke('daily-report', {
  method: 'POST',
  body: { date: '2024-01-01' },
});
```

## 8. Multi-Tenant SaaS

Separate data by tenant using row policies.

```ts
// Create tenant and user tables
await vortex.database.createTable('tenants', [
  { name: 'name', type: 'text', required: true },
  { name: 'plan', type: 'text' }, // free, pro, enterprise
]);
await vortex.database.createTable('tenant_users', [
  { name: 'tenant_id', type: 'text', required: true },
  { name: 'email', type: 'text', required: true },
  { name: 'role', type: 'text' }, // admin, member
]);

// Create a tenant
const tenant = await vortex.database.create('tenants', {
  name: 'Acme Corp',
  plan: 'pro',
  owner_id: session.user.id,
});

// Add a tenant member
await vortex.database.create('tenant_users', {
  tenant_id: tenant.id,
  email: 'team@acme.com',
  role: 'admin',
  owner_id: session.user.id,
});

// Create a row policy: users can only see their tenant's data
await vortex.database.createPolicy({
  name: 'tenant_isolation',
  tableName: 'tenant_users',
  action: 'select',
  using: { column: 'tenant_id', op: 'eq', value: '{identity.tenant_id}' },
  roles: ['user', 'admin'],
  enabled: true,
});
```

## Patterns

### Pattern: Auth + Realtime Bootstrap

```ts
// Sign in, then connect realtime
const session = await vortex.auth.signIn({ email, password });
vortex.realtime.connect(session.token);

// Wait for connection
vortex.realtime.onStatus((status) => {
  if (status === 'online') {
    vortex.realtime.subscribe('table:notes');
  }
});
```

### Pattern: Optimistic Updates

```ts
// Update UI immediately, then confirm with server
const oldStatus = task.status;
task.status = 'done'; // optimistic
renderTask(task);

try {
  await vortex.database.update('tasks',
    { status: 'done' },
    [{ column: 'id', op: 'eq', value: task.id }],
  );
} catch {
  task.status = oldStatus; // rollback
  renderTask(task);
  alert('Update failed');
}
```

### Pattern: Pagination

```ts
// Page 2, 20 per page
const page = 2;
const perPage = 20;

const result = await vortex.database.from('notes')
  .filter('owner_id', 'eq', session.user.id)
  .orderBy('created_at', 'desc')
  .limit(perPage)
  .offset(perPage * (page - 1))
  .execute();

const total = await vortex.database.count('notes', [
  { column: 'owner_id', op: 'eq', value: session.user.id },
]);
const totalPages = Math.ceil(total / perPage);
```

### Pattern: File Upload with Presigned URLs

```ts
// Get a presigned upload URL for direct-to-storage upload
const presign = await vortex.storage.presignUpload('images/photo.jpg', 'image/jpeg', 3600);

// Upload directly to S3/R2/MinIO (no server round-trip)
await fetch(presign.url, {
  method: 'PUT',
  headers: { 'content-type': 'image/jpeg', ...presign.headers },
  body: file,
});

// Or use the SDK upload (server-side)
await vortex.storage.upload('images', file, 'photo.jpg', 'image/jpeg');
```

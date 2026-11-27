# @nogroup/vortex

Vortex BaaS — TypeScript/JavaScript SDK for Node.js, browsers, and edge runtimes.

## Install

```bash
npm install @nogroup/vortex
# or
pnpm add @nogroup/vortex
# or
yarn add @nogroup/vortex
```

## Quick Start

```ts
import { VortexClient } from '@nogroup/vortex';

const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });

// Auth
const session = await vortex.auth.signup({ email: 'user@example.com', password: 'password' });

// Database
const notes = await vortex.database
  .from('notes')
  .filter('owner_id', 'eq', session.user.id)
  .limit(10)
  .execute();

// Storage
await vortex.storage.upload('uploads', file, 'avatar.png');

// Realtime
const rt = vortex.connectRealtime(session.token, {
  onTableChange: (event) => console.log(event.action, event.rows),
});
rt.subscribe('table:notes');

// Functions
const result = await vortex.functions.invoke('hello', { name: 'world' });

// Billing
const plans = await vortex.billing.listPlans();
const checkout = await vortex.billing.checkout({ planName: 'pro', email: 'user@example.com' });
```

## Modules

- `auth` — signup, login, magic links, OAuth, devices, notifications
- `database` — fluent query builder + raw CRUD
- `realtime` — WebSocket with durable replay
- `storage` — buckets, uploads, image transforms
- `functions` — deploy, invoke, manage
- `apps` — host static sites
- `billing` — plans, checkout, transactions, subscriptions
- `admin` — SQL console, policies, insights, user management

## License

Apache-2.0

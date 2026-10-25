# Vortex Webhooks

Deliver real-time events to external services. When data changes in
Vortex, registered webhooks receive signed HTTP POST requests — no polling,
no WebSocket connections on the receiving end.

## What triggers webhooks?

| Event | Trigger |
|---|---|
| `database.insert` | `POST /v1/db/:table` — new rows inserted |
| `database.upsert` | `POST /v1/db/:table/upsert` — rows upserted |
| `database.update` | `PATCH /v1/db/:table` — rows updated |
| `database.delete` | `DELETE /v1/db/:table` — rows deleted |
| `storage.upload` | `POST /v1/storage/upload` — object uploaded |
| `storage.delete` | `DELETE /v1/storage/object` — object deleted |
| `auth.signup` | `POST /v1/auth/signup` — new user registered |
| `apps.deploy` | `POST /v1/apps/:name` — app deployed |
| `functions.deploy` | `POST /v1/functions` — function deployed |

## Register a webhook

### SDK

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({ url: 'https://vortex.example.com' });

// Sign in first
const session = await vortex.auth.login({ email, password });

// Register a webhook
const webhook = await vortex.webhooks.create({
  url: 'https://example.com/api/webhooks',
  events: ['database.insert', 'database.update', 'database.delete'],
});

console.log(webhook.secret); // HMAC signing secret — store securely!
```

### API

```bash
curl -X POST https://vortex.example.com/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/api/webhooks",
    "events": ["database.insert", "storage.upload"]
  }'
```

### Console

Navigate to the **Webhooks** page in the Vortex Console to register,
manage, and inspect delivery logs visually.

## Receiving webhooks

Every webhook delivery is a `POST` request with:

- **`x-vortex-signature`** — HMAC-SHA256 hex signature of the body
- **`x-vortex-event`** — the event type (e.g. `database.insert`)
- **`Content-Type: application/json`**

The body is:

```json
{
  "event": "database.insert",
  "data": {
    "table": "notes",
    "rows": [{ "id": "...", "title": "Hello", "owner_id": "..." }],
    "count": 1
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Verify the signature

```ts
import { Webhooks } from '@vortex/client';
import crypto from 'node:crypto';

// In your Express/Fastify/Next.js handler:
app.post('/api/webhooks', async (req, res) => {
  // Get the raw body (must be before JSON parsing)
  const rawBody = Buffer.from(req.rawBody).toString();
  const signature = req.headers['x-vortex-signature'];

  // Verify using the secret from your database
  if (!Webhooks.verifySignature(signature, rawBody, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(rawBody);
  const { event, data } = payload;

  if (event === 'database.insert') {
    console.log('New rows inserted into', data.table);
    // ... handle the event
  }

  res.status(200).json({ ok: true });
});
```

### Verify without the SDK

```ts
import crypto from 'node:crypto';

function verifyVortexWebhook(signature: string, body: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return signature === expected;
}
```

## Managing webhooks

### List webhooks

```ts
const webhooks = await vortex.webhooks.list();
```

### Update a webhook

```ts
await vortex.webhooks.update(webhookId, {
  url: 'https://new-endpoint.example.com/webhooks',
  events: ['database.insert'],
  active: true,
});
```

### Regenerate the secret

```ts
const { secret } = await vortex.webhooks.regenerateSecret(webhookId);
// Update your server's stored secret
```

### Delete a webhook

```ts
await vortex.webhooks.delete(webhookId);
```

### View delivery log

```ts
const log = await vortex.webhooks.log(webhookId, 50);
// Each entry: { status, event, http_status, error, timestamp }
```

## Event payloads

### database.insert

```json
{
  "event": "database.insert",
  "data": {
    "table": "notes",
    "rows": [{ "id": "uuid", "title": "Hello", "owner_id": "uuid" }],
    "count": 1
  },
  "timestamp": "..."
}
```

### database.update

```json
{
  "event": "database.update",
  "data": {
    "table": "notes",
    "rows": [{ "id": "uuid", "title": "Updated" }],
    "count": 1,
    "patch": { "title": "Updated" }
  },
  "timestamp": "..."
}
```

### database.delete

```json
{
  "event": "database.delete",
  "data": {
    "table": "notes",
    "count": 3
  },
  "timestamp": "..."
}
```

### storage.upload

```json
{
  "event": "storage.upload",
  "data": {
    "key": "images/photo.jpg",
    "size": 10240,
    "contentType": "image/jpeg",
    "ownerId": "uuid"
  },
  "timestamp": "..."
}
```

### auth.signup

```json
{
  "event": "auth.signup",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "metadata": {},
      "createdAt": "..."
    }
  },
  "timestamp": "..."
}
```

## Best practices

1. **Always verify the signature** — reject requests with invalid signatures
2. **Respond quickly** — return 200 within seconds; do heavy work asynchronously
3. **Handle retries** — Vortex retries failed deliveries (HTTP 5xx, network errors)
4. **Store the secret securely** — never expose it in client-side code
5. **Use the delivery log** — inspect `vortex_webhook_log` for debugging
6. **Subscribe to specific events** — avoid `*` unless you need everything
7. **Idempotent handlers** — the same event may be delivered more than once

## Security

- Webhook payloads are signed with HMAC-SHA256 using a per-webhook secret
- The secret is generated on creation and can be regenerated at any time
- Only authenticated users can register webhooks (JWT required)
- Webhooks are scoped to the registering user — only their events are delivered
- The delivery log is retained for debugging and audit purposes

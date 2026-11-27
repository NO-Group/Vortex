# vortex-sdk — Rust SDK for Vortex BaaS

## Install

```toml
[dependencies]
vortex-sdk = "1.0"
```

## Quick Start

```rust
use vortex_sdk::VortexClient;

#[tokio::main]
async fn main() {
    let vortex = VortexClient::new("https://your-vortex.example.com");
    let session = vortex.auth().signup("user@example.com", "password").await.unwrap();
    let notes = vortex.database()
        .from("notes")
        .filter("owner_id", "eq", &session.user.id)
        .limit(10)
        .execute()
        .await
        .unwrap();
}
```

## Services

- `auth` — signup, login, me
- `database` — query builder, insert, update, delete
- `storage` — buckets, presigned uploads, image URLs
- `functions` — deploy, list, invoke, get, delete
- `apps` — create, list, get, delete
- `billing` — status, plans, checkout, transactions, subscription
- `admin` — SQL, policies, users, insights

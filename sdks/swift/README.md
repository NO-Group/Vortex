# VortexSwift — Swift SDK for Vortex BaaS

## Install (Swift Package Manager)

Add the package to your `Package.swift`:

```swift
.package(url: "https://github.com/no-group/vortex", from: "1.0.0")
```

## Quick Start

```swift
import VortexSwift

let vortex = VortexClient(baseURL: "https://your-vortex.example.com")
let session = await vortex.auth.signup(email: "user@example.com", password: "password")
let notes = await vortex.database
    .from("notes")
    .filter("owner_id", "eq", session.user.id)
    .limit(10)
    .execute()
```

## Services

- `auth` — signup, login, me, OAuth, notifications
- `database` — query builder, insert, update, delete, listTables
- `storage` — buckets, presigned uploads, image URLs
- `functions` — deploy, list, invoke, delete
- `apps` — create, list, delete
- `billing` — status, plans, checkout, transactions, subscription
- `admin` — SQL, policies, users, insights

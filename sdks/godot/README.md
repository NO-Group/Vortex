# vortex-godot — Godot SDK for Vortex BaaS

## Install

Copy the `.gd` scripts into your Godot project (e.g. into an `addons/vortex/` directory or your scripts folder).

## Quick Start

```gdscript
var vortex := VortexClient.new("https://your-vortex.example.com")
var session = await vortex.auth.signup("user@example.com", "password")
var notes = await vortex.database.from("notes") \
    .filter("owner_id", "eq", session.user.id) \
    .limit(10) \
    .execute()
```

## Services

- `auth` — signup, login, me, OAuth, notifications
- `database` — query builder, insert, list_tables
- `storage` — buckets, presigned uploads, image_url
- `functions` — deploy, list, invoke, delete
- `apps` — create, list, delete
- `billing` — status, plans, checkout, transactions, subscription
- `admin` — SQL, policies, users, insights

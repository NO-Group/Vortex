# vortex_sdk — Elixir SDK for Vortex BaaS

## Install

```elixir
def deps do
  [
    {:vortex_sdk, "~> 1.0"}
  ]
end
```

## Quick Start

```elixir
{:ok, vortex} = VortexSDK.Client.new("https://your-vortex.example.com")
{:ok, session} = vortex.auth().signup("user@example.com", "password")

{:ok, notes} = vortex.database()
  |> VortexSDK.Database.from("notes")
  |> VortexSDK.QueryBuilder.filter("owner_id", "eq", session["user"]["id"])
  |> VortexSDK.QueryBuilder.limit(10)
  |> VortexSDK.QueryBuilder.execute()
```

## Services

- `auth()` — signup, login, me, OAuth
- `database()` — query builder, insert, list_tables
- `storage()` — buckets, presigned uploads, image URLs
- `functions()` — deploy, list, invoke
- `apps()` — create, list
- `billing()` — status, plans, checkout, transactions
- `admin()` — SQL, policies, users, insights

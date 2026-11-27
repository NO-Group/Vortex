# NoGroup.Vortex — .NET SDK for Vortex BaaS

## Install

```bash
dotnet add package NoGroup.Vortex
```

## Quick Start

```csharp
using NoGroup.Vortex;

var vortex = new VortexClient("https://your-vortex.example.com");
var session = await vortex.Auth.SignupAsync("user@example.com", "password");
var notes = await vortex.Database
    .From("notes")
    .Filter("owner_id", "eq", session.User.Id)
    .Limit(10)
    .ExecuteAsync();
```

## Services

- `Auth` — Signup, Login, Me, OAuth, Notifications
- `Database` — QueryBuilder, Insert, Update, Delete, ListTables
- `Storage` — CreateBucket, ListBuckets, PresignUpload, ImageUrl
- `Functions` — Deploy, List, Invoke, Delete
- `Apps` — Create, List, Delete
- `Billing` — Status, Plans, Checkout, Transactions, Subscription
- `Admin` — Sql, Policies, Users, Insights

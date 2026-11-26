# vortex-go — Go SDK for Vortex BaaS

## Install

```bash
go get github.com/nogroup/vortex-go
```

## Quick Start

```go
import vortex "github.com/nogroup/vortex-go"

func main() {
    v := vortex.New("https://your-vortex.example.com")
    session, _ := v.Auth.Signup(context.Background(), "user@example.com", "password")
    notes, _ := v.Database.From("notes").
        Filter("owner_id", "eq", session.User.ID).
        Limit(10).
        Execute(context.Background())
    _ = notes
}
```

## Services

- `Auth` — Signup, Login, Me, ListOAuthProviders
- `Database` — From (query builder), Insert, ListTables
- `Storage` — CreateBucket, ListBuckets, PresignUpload, ImageURL
- `Functions` — Deploy, List, Invoke, Get, Delete
- `Apps` — Create, List, Get, Delete
- `Billing` — Status, ListPlans, Checkout, ListTransactions, GetSubscription, CancelSubscription
- `Admin` — SQL, ListPolicies, CreatePolicy, ListUsers, InsightsOverview

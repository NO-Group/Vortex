# VortexSDK — Unreal Engine SDK for Vortex BaaS

## Install

1. Copy the `VortexSDK` plugin folder into your Unreal project's `Plugins/` directory.
2. Enable the plugin in **Edit → Plugins → VortexSDK**.
3. Restart the editor.

## Quick Start (Blueprint)

1. Create a `VortexClient` actor or variable.
2. Call `Initialize` with your Vortex URL (e.g. `https://your-vortex.example.com`).
3. Call `Auth → Signup` with email/password and bind success/error delegates.

## Quick Start (C++)

```cpp
auto* vortex = NewObject<UVortexClient>();
vortex->Initialize(FString(TEXT("https://your-vortex.example.com")));

vortex->Auth->Signup(
    FString(TEXT("user@example.com")),
    FString(TEXT("password")),
    FVortexResponse::CreateDynamicDelegate(this, &ThisClass::OnSignup),
    FVortexError::CreateDynamicDelegate(this, &ThisClass::OnError)
);
```

## Services

- **Auth** — Signup, Login, Me, ListOAuthProviders, RegisterDevice, SendNotification
- **Database** — From (QueryBuilder), Insert, ListTables
- **Storage** — CreateBucket, ListBuckets, PresignUpload
- **Functions** — Deploy, List, Invoke, Delete
- **Apps** — Create, List, Delete
- **Billing** — Status, ListPlans, Checkout, ListTransactions, GetSubscription, CancelSubscription, GetMe
- **Admin** — Sql, ListPolicies, CreatePolicy, ListUsers, InsightsOverview

## Requirements

- Unreal Engine 5.x
- C++17

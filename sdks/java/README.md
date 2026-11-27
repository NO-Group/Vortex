# vortex-sdk — Java/Kotlin SDK for Vortex BaaS

## Install (Maven)

```xml
<dependency>
  <groupId>org.nogroup</groupId>
  <artifactId>vortex-sdk</artifactId>
  <version>1.0.0</version>
</dependency>
```

## Quick Start (Kotlin)

```kotlin
import org.nogroup.vortex.VortexClient

val vortex = VortexClient("https://your-vortex.example.com")
val session = vortex.auth().signup("user@example.com", "password")
val notes = vortex.database()
    .from("notes")
    .filter("owner_id", "eq", session.user.id)
    .limit(10)
    .execute()
```

## Services

- `auth` — signup, login, me, OAuth, notifications
- `database` — query builder, insert, update, delete, listTables
- `storage` — buckets, presigned uploads, image URLs
- `functions` — deploy, list, invoke, get, delete
- `apps` — create, list, get, delete
- `billing` — status, plans, checkout, transactions, subscription
- `admin` — SQL, policies, users, insights

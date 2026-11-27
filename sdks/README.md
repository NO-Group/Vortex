# Vortex SDKs

Official SDKs for the Vortex Backend-as-a-Service. Each SDK is self-contained in its own directory with its own manifest, client, and service modules.

## SDKs

| Language | Directory | Package | Install |
|---|---|---|---|
| TypeScript / JavaScript | [`typescript/`](./typescript) | `@nogroup/vortex` | `npm install @nogroup/vortex` |
| Dart | [`dart/`](./dart) | `vortex_sdk` | `dart pub add vortex_sdk` |
| Python | [`python/`](./python) | `vortex-cloud` | `pip install vortex-cloud` |
| Go | [`go/`](./go) | `github.com/nogroup/vortex-go` | `go get github.com/nogroup/vortex-go` |
| Rust | [`rust/`](./rust) | `vortex-sdk` | `cargo add vortex-sdk` |
| Java / Kotlin | [`java/`](./java) | `org.nogroup:vortex-sdk` | Maven dependency |
| Swift | [`swift/`](./swift) | `VortexSwift` | Swift Package Manager |
| C# / .NET | [`dotnet/`](./dotnet) | `NoGroup.Vortex` | `dotnet add package NoGroup.Vortex` |
| PHP / Laravel | [`php/`](./php) | `nogroup/vortex-php` | `composer require nogroup/vortex-php` |
| Ruby | [`ruby/`](./ruby) | `vortex-sdk` | `gem install vortex-sdk` |
| C / C++ | [`cpp/`](./cpp) | `vortex-cpp` | CMake `add_subdirectory` |
| Elixir | [`elixir/`](./elixir) | `vortex_sdk` | `mix deps.get vortex_sdk` |
| Godot | [`godot/`](./godot) | `vortex-godot` | Copy scripts into project |
| Unity | [`unity/`](./unity) | `com.nogroup.vortex` | Copy into Assets/ |
| Unreal Engine | [`unreal/`](./unreal) | `VortexSDK` | Plugin import |
| CLI | [`cli/`](./cli) | `@nogroup/vortex-cli` | `npm install -g @nogroup/vortex-cli` |

## Common API

All SDKs share the same service surface:

- **Auth** — signup, login, me, OAuth providers, notifications
- **Database** — query builder (filter, limit, offset, orderBy, countTotal), insert, update, delete, listTables
- **Storage** — buckets, presigned uploads, image URL transforms
- **Functions** — deploy, list, invoke, delete
- **Apps** — create, list, get, delete
- **Billing** — status, plans, checkout, transactions, subscription
- **Admin** — raw SQL, policies, users, insights

## Quick Start (TypeScript)

```ts
import { VortexClient } from '@nogroup/vortex';

const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });
const session = await vortex.auth.signup({ email: 'user@example.com', password: 'password' });
const notes = await vortex.database.from('notes')
  .filter('owner_id', 'eq', session.user.id)
  .limit(10)
  .execute();
```

## Quick Start (Python)

```python
from vortex_cloud import VortexClient

async with VortexClient(url="https://your-vortex.example.com") as vortex:
    session = await vortex.auth.signup(email="user@example.com", password="password")
    notes = await vortex.database.from_table("notes").filter("owner_id", "eq", session.user.id).limit(10).execute()
```

## Quick Start (CLI)

```bash
vortex init https://your-vortex.example.com
vortex auth signup user@example.com password
vortex db tables
```

## License

Apache-2.0

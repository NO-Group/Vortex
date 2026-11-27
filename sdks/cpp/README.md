# vortex-cpp — C/C++ SDK for Vortex BaaS

## Build

```bash
cmake -B build
cmake --build build
```

## Quick Start

```cpp
#include "vortex.h"

int main() {
    vortex::Client vortex("https://your-vortex.example.com");
    auto session = vortex.auth().signup("user@example.com", "password");
    auto notes = vortex.database().from("notes")
        .filter("owner_id", "eq", session["user"]["id"])
        .limit(10)
        .execute();
    return 0;
}
```

## Services

- `auth()` — signup, login, me, OAuth, notifications
- `database()` — query builder, insert, listTables
- `storage()` — buckets, presigned uploads, image URLs
- `functions()` — deploy, list, invoke, get, delete
- `apps()` — create, list, get, delete
- `billing()` — status, plans, checkout, transactions, subscription
- `admin()` — SQL, policies, users, insights

## Dependencies

- libcurl (with OpenSSL)
- CMake 3.14+
- C++17

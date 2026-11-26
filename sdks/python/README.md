# vortex-cloud — Python SDK for Vortex BaaS

## Install

```bash
pip install vortex-cloud
```

## Quick Start

```python
import asyncio
from vortex_cloud import VortexClient

async def main():
    async with VortexClient(url="https://your-vortex.example.com") as vortex:
        session = await vortex.auth.signup(email="user@example.com", password="password")
        notes = await vortex.database.from_table("notes") \
            .filter("owner_id", "eq", session["user"]["id"]) \
            .limit(10) \
            .execute()
        print(notes)

asyncio.run(main())
```

## Services

- `auth` — signup, login, me, OAuth
- `database` — query builder, insert, update, delete
- `storage` — buckets, presigned uploads
- `functions` — deploy, list, invoke
- `apps` — create, list
- `billing` — status, plans, checkout
- `admin` — SQL, policies, users

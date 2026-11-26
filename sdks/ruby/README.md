# vortex-sdk — Ruby SDK for Vortex BaaS

## Install

```bash
gem install vortex-sdk
```

## Quick Start

```ruby
require 'vortex_sdk'

vortex = VortexSDK.client('https://your-vortex.example.com')
session = vortex.auth.signup('user@example.com', 'password')
notes = vortex.database
  .from('notes')
  .filter('owner_id', 'eq', session['user']['id'])
  .limit(10)
  .execute
```

## Services

- `auth` — signup, login, me, OAuth, notifications
- `database` — query builder, insert, list_tables
- `storage` — buckets, presigned uploads, image URLs
- `functions` — deploy, list, invoke
- `apps` — create, list
- `billing` — status, plans, checkout, transactions, subscription
- `admin` — SQL, policies, users, insights

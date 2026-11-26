# nogroup/vortex-php — PHP SDK for Vortex BaaS

## Install

```bash
composer require nogroup/vortex-php
```

## Quick Start

```php
use NoGroup\Vortex\VortexClient;

$vortex = new VortexClient('https://your-vortex.example.com');
$session = $vortex->auth()->signup('user@example.com', 'password');
$notes = $vortex->database()->from('notes')
    ->filter('owner_id', 'eq', $session['user']['id'])
    ->limit(10)
    ->execute();
```

## Services

- `auth()` — signup, login, me, OAuth, notifications
- `database()` — query builder, insert, update, delete, listTables
- `storage()` — buckets, presigned uploads, image URLs
- `functions()` — deploy, list, invoke, get, delete
- `apps()` — create, list, get, delete
- `billing()` — status, plans, checkout, transactions, subscription
- `admin()` — SQL, policies, users, insights

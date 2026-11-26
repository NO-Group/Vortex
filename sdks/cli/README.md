# @nogroup/vortex-cli — Vortex BaaS Command-Line Interface

## Install

```bash
npm install -g @nogroup/vortex-cli
```

## Quick Start

```bash
# Initialize with your Vortex URL
vortex init https://your-vortex.example.com

# Sign up / log in
vortex auth signup user@example.com password
vortex auth login user@example.com password

# Query the database
vortex db tables
vortex db query notes '{"filters":[],"limit":10}'

# Storage
vortex storage buckets

# Functions
vortex functions list
vortex functions invoke myFunction '{"key":"value"}'

# Billing
vortex billing plans
vortex billing status

# Admin
vortex admin sql "SELECT * FROM users LIMIT 10"
```

## Commands

| Command | Description |
|---|---|
| `init <baseUrl>` | Initialize a config file |
| `auth signup <email> <pw>` | Sign up a new user |
| `auth login <email> <pw>` | Log in and save a token |
| `auth me` | Show the current user |
| `db tables` | List database tables |
| `db query <table> <json>` | Run a database query |
| `storage buckets` | List storage buckets |
| `functions list` | List deployed functions |
| `functions invoke <name> <json>` | Invoke a function |
| `apps list` | List apps |
| `billing plans` | List billing plans |
| `billing status` | Show billing status |
| `admin sql <statement>` | Run raw SQL (admin) |

## Config

The CLI stores configuration in `vortex-cli.config.json` next to the script:

```json
{
  "baseUrl": "https://your-vortex.example.com",
  "token": "jwt-token-here"
}
```

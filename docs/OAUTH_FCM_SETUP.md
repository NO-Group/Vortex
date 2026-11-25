# 🔐 OAuth & FCM Setup Guide

Step-by-step instructions to get credentials for OAuth login providers and Firebase Cloud Messaging (FCM). After collecting the credentials, give them to your developer and they'll wire them in instantly.

---

## Part 1: OAuth Providers

Vortex supports 6 OAuth providers. You only need to create an OAuth app on each provider you want to support. **You don't need all of them** — start with Google and GitHub (most popular), then add others later.

For each provider, you'll need:
- **Client ID**
- **Client Secret**
- **Redirect URL**: `https://vortex.no-group.org/v1/auth/oauth/callback/{provider}`

Example redirect URLs:
- Google: `https://vortex.no-group.org/v1/auth/oauth/callback/google`
- GitHub: `https://vortex.no-group.org/v1/auth/oauth/callback/github`
- Discord: `https://vortex.no-group.org/v1/auth/oauth/callback/discord`

---

### 1. Google

**URL:** https://console.cloud.google.com/apis/credentials

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application** as the application type
4. Add **Authorized redirect URIs**:
   ```
   https://vortex.no-group.org/v1/auth/oauth/callback/google
   ```
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

**What to give your developer:**
```
Google OAuth:
  Client ID: xxxxx.apps.googleusercontent.com
  Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 2. GitHub

**URL:** https://github.com/settings/developers

1. Go to **GitHub** → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. **Application name**: Vortex
3. **Homepage URL**: `https://vortex.no-group.org`
4. **Authorization callback URL**:
   ```
   https://vortex.no-group.org/v1/auth/oauth/callback/github
   ```
5. Click **Register application**
6. Click **Generate a client secret**
7. Copy the **Client ID** and **Client Secret**

**What to give your developer:**
```
GitHub OAuth:
  Client ID: Iv1.xxxxxxxxxxxxxxxxxxxx
  Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 3. Discord

**URL:** https://discord.com/developers/applications

1. Go to **Discord Developer Portal** → **Applications** → **New Application**
2. Go to **OAuth2** → **URL Generator**
3. Select scopes: `identify`, `email`
4. Add **Redirect URL**:
   ```
   https://vortex.no-group.org/v1/auth/oauth/callback/discord
   ```
5. Copy the **Client ID** and **Client Secret** from **OAuth2** → **Client Credentials**

**What to give your developer:**
```
Discord OAuth:
  Client ID: xxxxxxxxxxxxxxxxxxxxxxxx
  Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 4. GitLab

**URL:** https://gitlab.com/-/profile/applications

1. Go to **GitLab** → **Preferences** → **Applications** → **New application**
2. **Name**: Vortex
3. **Redirect URI**:
   ```
   https://vortex.no-group.org/v1/auth/oauth/callback/gitlab
   ```
4. Select scopes: `read_user`
5. Click **Save application**
6. Copy the **Application ID** (Client ID) and **Secret** (Client Secret)

**What to give your developer:**
```
GitLab OAuth:
  Client ID: xxxxxxxxxxxxxxxxxxxxxxx
  Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 5. Microsoft

**URL:** https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations** → **New registration**
2. **Name**: Vortex
3. **Supported account types**: Accounts in any organizational directory and any personal Microsoft account
4. **Redirect URI**: Web →
   ```
   https://vortex.no-group.org/v1/auth/oauth/callback/microsoft
   ```
5. Click **Register**
6. Go to **Certificates & secrets** → **New client secret** → copy the **Value** (Client Secret)
7. Copy the **Application (client) ID** (Client ID)

**What to give your developer:**
```
Microsoft OAuth:
  Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 6. Apple

**URL:** https://developer.apple.com/account

> ⚠️ **Requires an Apple Developer account ($99/year).** Skip if you don't have one.

1. Go to **Apple Developer** → **Certificates, IDs & Profiles** → **Keys** → **+**
2. Select **Apple Push Notification service (APNs)** — wait, for OAuth you need:
   - Go to **Identifiers** → **+** → **Services IDs** → **Continue**
   - **Description**: Vortex
   - **Identifier**: com.vortex.app (or any unique ID)
   - **Capabilities**: Check **Sign in with Apple**
   - **Domains**: Add `vortex.no-group.org`
   - **Return URLs**: `https://vortex.no-group.org/v1/auth/oauth/callback/apple`
3. Create a **Key** under **Keys** → select **Sign in with Apple** → configure with your Service ID
4. Download the `.p8` key file
5. Copy the **Key ID** and **Team ID**

**What to give your developer:**
```
Apple OAuth:
  Client ID (Service ID): com.vortex.app
  Key ID: XXXXXXXXXXX
  Team ID: XXXXXXXXXXX
  .p8 key file: (upload the .p8 file contents)
```

---

## Part 2: Firebase Cloud Messaging (FCM)

FCM is for **Android push notifications**. You need a Firebase project.

**URL:** https://console.firebase.google.com

### Steps:

1. **Create a Firebase project:**
   - Go to **Firebase Console** → **Create project**
   - Enter project name (e.g., `Vortex`)
   - Click **Create project** (wait for it to finish initializing)

2. **Get the Project ID:**
   - Go to **Project Settings** (gear icon → Project settings)
   - Copy the **Project ID** (e.g., `vortex-xxxxx`)

3. **Generate a service account key:**
   - Go to **Project Settings** → **Service accounts** tab
   - Click **Generate private key**
   - A JSON file downloads — open it and copy the entire **private_key** field content

**What to give your developer:**
```
FCM (Firebase):
  FCM_PROJECT_ID: vortex-xxxxx
  FCM_PRIVATE_KEY: -----BEGIN PRIVATE KEY-----
  ...entire private key content...
  -----END PRIVATE KEY-----
```

> **Note:** The private key is a multi-line PEM string. Your developer will put it directly into the `.env` file.

---

## Part 3: Summary — What to Provide

Once you've collected the credentials, provide them in this format:

```
Google:
  Client ID: xxxxx
  Client Secret: xxxxx

GitHub:
  Client ID: xxxxx
  Client Secret: xxxxx

Discord (optional):
  Client ID: xxxxx
  Client Secret: xxxxx

GitLab (optional):
  Client ID: xxxxx
  Client Secret: xxxxx

Microsoft (optional):
  Client ID: xxxxx
  Client Secret: xxxxx

Apple (optional — requires $99/yr Apple Developer account):
  Client ID: xxxxx
  Key ID: xxxxx
  Team ID: xxxxx
  .p8 key: (file contents)

FCM (Firebase):
  FCM_PROJECT_ID: xxxxx
  FCM_PRIVATE_KEY: (full PEM key)
```

**APNs is skipped** — no iOS account needed.

Your developer will:
1. Add FCM credentials to `.env` (`FCM_PROJECT_ID` and `FCM_PRIVATE_KEY`)
2. Configure OAuth providers through the Vortex dashboard (OAuth page) — they're stored in the database, not `.env`
3. Restart the server: `docker compose restart vortex-server`

---

## Part 4: Configure OAuth in the Dashboard

After your developer wires in the credentials, you (or they) configure OAuth providers through the Vortex dashboard:

1. Log in to the Vortex dashboard at `https://vortex.no-group.org`
2. Go to **Auth** → **OAuth** page
3. For each provider, click **Add Provider** and fill in:
   - **Provider name** (e.g., `google`)
   - **Client ID**
   - **Client Secret**
4. Save — the "Sign in with Google/GitHub/etc." button will appear on the login screen

---

*Last updated: 2026-10-23*

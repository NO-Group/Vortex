# 🏗️ Social App Quick-Start Guide

Building the **test social app** on Vortex — your proof of concept before public launch. This guide walks through building a complete social application (posts, comments, likes, realtime feed) using Vortex as the backend.

---

## Overview

The social app validates every Vortex service:

| Vortex Service | What It Powers in the App |
|----------------|--------------------------|
| **Auth** | User signup, login, profiles |
| **Database** | Posts, comments, likes, follows |
| **Storage** | User avatars, post images |
| **Realtime** | Live feed — new posts appear instantly |
| **Webhooks** | Notifications, activity tracking |

---

## Tech Stack

- **Frontend**: Next.js (App Router) or Vite + React
- **Styling**: Tailwind CSS (matches Vortex design system)
- **Vortex**: REST API + WebSocket for realtime
- **State**: React hooks or TanStack Query

---

## Step 1: Project Setup

```bash
# Create the app
npx create-next-app@latest social-app --ts --tailwind
cd social-app

# Install API client
npm install @tanstack/react-query
```

## Step 2: Configure Vortex Connection

Create `lib/vortex.ts`:

```typescript
const VORTEX_URL = process.env.NEXT_PUBLIC_VORTEX_URL || 'https://your-domain.com';

// Auth — get JWT token from login/signup
async function getToken(): Promise<string> {
  // Store token in localStorage or cookies after login
  return localStorage.getItem('vortex_token') || '';
}

// Authenticated fetch wrapper
export async function api(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${VORTEX_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Realtime WebSocket
export function connectRealtime(table: string, onEvent: (event: any) => void) {
  const ws = new WebSocket(`${VORTEX_URL.replace('http', 'ws')}/v1/realtime`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', table }));
  };
  ws.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === 'insert' || event.type === 'update' || event.type === 'delete') {
      onEvent(event);
    }
  };
  return ws;
}
```

## Step 3: Authentication

### Sign Up

```typescript
// Sign up a new user
async function signUp(email: string, name: string) {
  return api('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
}
```

### Login

```typescript
// Log in with email/password
async function login(email: string, password: string) {
  const res = await api('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  // res.token — store in localStorage
  localStorage.setItem('vortex_token', res.token);
  return res.user;
}
```

## Step 4: Database — Posts

### Create a table

```typescript
// Create the posts table (or do this via the Vortex dashboard)
await api('/v1/db/tables', {
  method: 'POST',
  body: JSON.stringify({
    name: 'posts',
    columns: {
      id: { type: 'uuid', primary: true },
      user_id: { type: 'uuid', required: true },
      content: { type: 'text', required: true },
      image_url: { type: 'text' },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  },
});
```

### Create a post

```typescript
async function createPost(content: string, imageUrl?: string) {
  const user = await getCurrentUser();
  return api('/v1/db/posts', {
    method: 'POST',
    body: JSON.stringify({
      user_id: user.id,
      content,
      image_url: imageUrl,
    },
  });
}
```

### Fetch posts (feed)

```typescript
async function getPosts(page = 1, limit = 20) {
  return api(`/v1/db/posts?order=-created_at&limit=${limit}&page=${page}`);
}
```

### Delete a post

```typescript
async function deletePost(postId: string) {
  return api(`/v1/db/posts/${postId}`, { method: 'DELETE' });
}
```

## Step 5: Realtime Feed

Subscribe to the `posts` table and update the UI live:

```typescript
import { useEffect, useState } from 'react';

function useRealtimePosts() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Load initial posts
    getPosts().then(setPosts);

    // Subscribe to realtime updates
    const ws = connectRealtime('posts', (event) => {
      if (event.type === 'insert') {
        setPosts((prev) => [event.data, ...prev]);
      } else if (event.type === 'delete') {
        setPosts((prev) => prev.filter((p) => p.id !== event.data.id));
      }
    });

    return () => ws.close();
  }, []);

  return posts;
}
```

## Step 6: File Uploads (Avatars & Images)

### Get a presigned upload URL

```typescript
async function getUploadUrl(filename: string, contentType: string) {
  return api('/v1/storage/upload/sign', {
    method: 'POST',
    body: JSON.stringify({
      filename,
      content_type: contentType,
    },
  });
  // Returns: { url, public_url }
}

// Then upload directly from the browser
async function uploadImage(file: File) {
  const { url, public_url } = await getUploadUrl(file.name, file.type);
  await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  return public_url; // Use this as image_url in posts
}
```

## Step 7: Comments

```typescript
// Create comments table
await api('/v1/db/tables', {
  method: 'POST',
  body: JSON.stringify({
    name: 'comments',
    columns: {
      id: { type: 'uuid', primary: true },
      post_id: { type: 'uuid', required: true },
      user_id: { type: 'uuid', required: true },
      content: { type: 'text', required: true },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  },
});

// Add a comment
async function addComment(postId: string, content: string) {
  const user = await getCurrentUser();
  return api('/v1/db/comments', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, user_id: user.id, content }),
  });
}

// Get comments for a post
async function getComments(postId: string) {
  return api(`/v1/db/comments?post_id=eq.${postId}&order=created_at`);
}
```

## Step 8: Likes

```typescript
// Create likes table
await api('/v1/db/tables', {
  method: 'POST',
  body: JSON.stringify({
    name: 'likes',
    columns: {
      id: { type: 'uuid', primary: true },
      post_id: { type: 'uuid', required: true },
      user_id: { type: 'uuid', required: true },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  },
});

// Like a post
async function likePost(postId: string) {
  const user = await getCurrentUser();
  return api('/v1/db/likes', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, user_id: user.id }),
  });
}

// Check if liked + get like count
async function getPostLikes(postId: string) {
  const [liked, count] = await Promise.all([
    api(`/v1/db/likes?post_id=eq.${postId}&user_id=eq.USER_ID&limit=1`),
    api(`/v1/db/likes?post_id=eq.${postId}&limit=1`),
  ]);
  return { liked: liked.length > 0, count: count.length };
}
```

## Step 9: User Profiles

```typescript
// Create users table
await api('/v1/db/tables', {
  method: 'POST',
  body: JSON.stringify({
    name: 'profiles',
    columns: {
      id: { type: 'uuid', primary: true },
      user_id: { type: 'uuid', required: true, unique: true },
      name: { type: 'text', required: true },
      bio: { type: 'text' },
      avatar_url: { type: 'text' },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  },
});
```

## Step 10: Follow/Unfollow

```typescript
// Create follows table
await api('/v1/db/tables', {
  method: 'POST',
  body: JSON.stringify({
    name: 'follows',
    columns: {
      id: { type: 'uuid', primary: true },
      follower_id: { type: 'uuid', required: true },
      followee_id: { type: 'uuid', required: true },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  },
});

async function followUser(userId: string) {
  const me = await getCurrentUser();
  return api('/v1/db/follows', {
    method: 'POST',
    body: JSON.stringify({ follower_id: me.id, followee_id: userId }),
  });
}
```

---

## Dashboard Setup

Before building, set up the Vortex dashboard:

1. **Create tables** — Use the dashboard's Database page to create `posts`, `comments`, `likes`, `profiles`, `follows` tables (or use the API as shown above)
2. **Set up RBAC** — Create a "user" role with permissions to read/write their own data
3. **Configure storage** — Ensure the `vortex` bucket is ready for avatar/image uploads
4. **Test realtime** — Use the dashboard's realtime page to verify WebSocket connections work

---

## Testing Checklist

Before going public, verify the social app:

- [ ] Users can sign up and log in
- [ ] Users can create, edit, and delete posts
- [ ] Posts with images upload and display correctly
- [ ] Comments can be added and deleted
- [ ] Likes toggle correctly and count updates
- [ ] Realtime feed updates instantly when new posts are created
- [ ] User profiles display correctly with avatars
- [ ] Follow/unfollow works
- [ ] No unauthorized access (RBAC working)
- [ ] Performance is smooth with 10+ concurrent users

---

## Launch Decision

The social app is your **proof of concept**. If:
- ✅ All features work smoothly
- ✅ Realtime latency is sub-50ms
- ✅ No security issues
- ✅ Performance is stable under test load

→ **Green light for public launch.**

If issues are found:
- ❌ Fix them first
- ❌ Re-test
- ❌ Only launch when confident

---

*Last updated: 2026-10-23*

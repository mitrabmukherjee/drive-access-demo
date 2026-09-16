# Drive access demo

Standalone Next.js demo: every user grants **Google Drive** on login. Upload a file; it is saved in **your** Drive (folder `Drive Access Demo`). When you assign a colleague, the app calls Drive `permissions.create` **as you** and shares that file with their `@steorasystems.com` address.

This is not the CRM. It uses Postgres (local and/or Neon).

## Prerequisites

1. GCP project **drive-access-demo** with **Google Drive API** enabled.
2. OAuth consent screen **Internal**, scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive`
3. OAuth **Web** client:
   - Authorized JavaScript origins: `http://localhost:3000` and `https://drive-access-demo.vercel.app` (required for browser → Drive upload)
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` and `https://drive-access-demo.vercel.app/api/auth/callback/google`
4. Two `@steorasystems.com` accounts.

The file is uploaded from the browser straight to Google Drive (not through Vercel), so large files are fine. JavaScript origins must match the page origin or the resumable upload will fail in CORS.

## Setup

```bash
cd C:\Users\Steora\drive-access-demo
npm install
npx prisma migrate deploy
npm run dev
```

Stop `npm run dev` before `npx prisma generate` on Windows, or Prisma hits `EPERM` renaming `query_engine-windows.dll.node`. `migrate deploy` applies SQL without that generate step. After stopping the server you can run `npx prisma generate` if the client is stale.

Open [http://localhost:3000](http://localhost:3000). The Google OAuth client is registered for that origin. If something else is already using port 3000, stop it first — Next.js must not fall back to another port or sign-in will fail.

Copy `.env.example` to `.env` / `.env.local` if needed:

```
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_SECRET=
AUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/drive_access_demo"
```

Do not commit `.env` or `.env.local`.

## Test with two users

1. User A signs in and accepts Drive access.
2. User A uploads a file. It appears in their Drive under **Drive Access Demo**, and in **Files I own**.
3. User A assigns User B as Viewer (or Editor).
4. Incognito as User B: the Drive link should open. User B can also sign into this demo and see the file under **Assigned to me** without refreshing (live SSE).
5. User A clicks **Unassign**. User B should lose access (new tab / short delay) and the demo list should drop the file live.

## Limits

- Sharing only works if the signed-in owner can share that file in Drive.
- If the user removes the app in Google Account, the refresh token dies — they must sign in again.
- Refresh tokens live in Postgres. Fine for a demo; treat production credentials as secrets.
- Live assign/unassign uses Postgres-backed SSE, so it works across Vercel instances that share `DATABASE_URL`.

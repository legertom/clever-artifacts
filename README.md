# Clever Artifacts

An internal place to upload the HTML export of a Claude artifact and share it with
the right people. Each upload is a static snapshot, so opening it never re-runs the
artifact's data loading. Sign-in is Google SSO, limited to `@clever.com` accounts.

- **My artifacts** – everything you uploaded, with a screenshot preview.
- **Shared with me** – artifacts other people made visible to everyone at Clever, or
  shared with you by email.
- Visibility per artifact: *Everyone at clever.com* (default) or *Specific people*.
- Owners can rename, change sharing, replace the HTML, regenerate the preview, or delete.

Stack: Next.js 16 (App Router) · Auth.js v5 (Google) · Neon Postgres via Drizzle ·
Puppeteer + serverless Chromium for previews · Tailwind v4.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment** – copy `.env.example` to `.env.local` and fill it in:

   | Variable | Notes |
   | --- | --- |
   | `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 32` |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth client from Google Cloud Console → *APIs & Services → Credentials*. Add `http://localhost:3000/api/auth/callback/google` and your production URL (`https://<host>/api/auth/callback/google`) as authorized redirect URIs. |
   | `ALLOWED_EMAIL_DOMAIN` | `clever.com`. Controls who may sign in and who can be shared with. |
   | `DATABASE_URL` | Neon connection string (the pooled one is fine). |
   | `CHROME_EXECUTABLE_PATH` | Optional, local dev only. Chrome is auto-detected on macOS/Linux. |

3. **Database** – create the tables in Neon:

   ```bash
   npm run db:push
   ```

   (`drizzle/` holds the equivalent SQL migration if you prefer `npm run db:migrate`.)

4. **Run**

   ```bash
   npm run dev
   ```

## Deploying to Vercel

- Set the same environment variables in the project settings. `AUTH_URL` is not needed on Vercel.
- Preview screenshots use `@sparticuz/chromium`, which is traced into the
  `/api/artifacts*` functions by `next.config.ts`. Those routes set `maxDuration = 60`;
  Hobby plans may need Fluid Compute enabled to allow that.
- Uploads are capped at 4 MB because Vercel functions reject bodies above ~4.5 MB. If
  larger exports become common, switch uploads to Vercel Blob client uploads.

## How access control works

- `proxy.ts` redirects signed-out visitors to `/login` (cookie check only).
- Every page and route handler re-checks the session and the artifact's
  visibility/share list (`src/lib/artifacts.ts`).
- Artifact HTML is served from `/a/<id>/raw` with a
  `Content-Security-Policy: sandbox …` header and embedded in a sandboxed `<iframe>`
  (no `allow-same-origin`). Scripts inside an uploaded file therefore run with an
  opaque origin and can't read cookies or call this app's API as the viewer.
- Screenshots are rendered in headless Chrome with request interception that blocks
  non-HTTP(S) URLs and private/internal hosts.

## Project layout

```
src/
  auth.config.ts, auth.ts   Auth.js (Google, domain restriction, user upsert)
  proxy.ts                  Signed-in gate for all routes
  db/schema.ts              users, artifacts, artifact_shares
  lib/artifacts.ts          Queries + authorization helpers
  lib/screenshot.ts         Headless Chrome screenshot (local Chrome or serverless)
  actions/                  Server actions (sign in/out, update, delete)
  app/
    page.tsx                Dashboard (My artifacts / Shared with me)
    upload/                 Upload form
    a/[id]/                 Viewer, raw HTML, owner settings
    api/artifacts/          Create, replace, preview image, regenerate
    api/users/              Autocomplete for the share list
```

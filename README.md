# Clever Artifacts

An internal place to upload the HTML export of a Claude artifact and share it with
the right people. Each upload is a static snapshot, so opening it never re-runs the
artifact's data loading. Sign-in is Google SSO, limited to `@clever.com` accounts.

Live at **https://clever-artifacts.vercel.app** (Vercel project `clever-artifacts`,
GitHub `legertom/clever-artifacts`, Neon database via the Vercel integration).

- **Dashboard** – *My artifacts*, *Shared with me* (company-wide or shared directly),
  *Favorites* (anything you've starred) and *Trash*. Hovering a card slides up a strip
  with a star and, for your own artifacts, a trash can. Trashing asks for confirmation
  and spells out the 30-day purge.
- **Favorites** – personal stars on anything you can open; filter any list to
  *Starred only*. Nobody else sees your stars.
- **Search** (`/search`, box in every header) – across everything you can open: yours,
  shared with you, and company-wide; by name, description, `#tag` or person.
- **Pretty links** – `/a/<slug>` generated from the name (or typed by the uploader);
  editable later, and old links keep redirecting. A *Copy link* button in the viewer's
  top bar puts the link on the clipboard.
- **Metadata** – name, description, source link (e.g. the Claude conversation), tags,
  visibility (*Only me* by default, *Specific people*, or *Everyone at clever.com*), view count.
  Private artifacts can't be opened by anyone else except admins. Under *Specific people*,
  managers (per the directory) can also tick *My direct reports*, which follows the org chart.
- **Owner actions** – rename, change the link, edit sharing, replace the HTML,
  regenerate the preview, move to trash, restore, delete permanently.
- **Trash** – anything in the trash for 30 days is purged (lazily on dashboard load
  and by a daily Vercel cron hitting `/api/cron/purge-trash`).
- **Admin** (`/admin`, emails in `ADMIN_EMAILS`) – every artifact incl. trashed,
  views per day, per-artifact views / unique viewers / shares, people, recent activity.
  Admins can open and manage any artifact.
- **MCP server** (`/api/mcp`, Streamable HTTP) – the whole app as tools, for Claude,
  Claude Code, Cursor, etc. Secured by an in-app OAuth 2.1 server (PKCE, dynamic client
  registration, Client ID Metadata Documents, refresh-token rotation) or personal
  tokens from `/settings/mcp`.

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
   | `ADMIN_EMAILS` | Comma-separated admins. Defaults to tom.leger@clever.com, kate.schaff@clever.com. |
   | `CRON_SECRET` | Any random string; Vercel sends it as a bearer token to the purge cron. |
   | `APP_URL` | Optional public origin override for OAuth issuer / links (auto-detected otherwise). |
   | `CHROME_EXECUTABLE_PATH` | Optional, local dev only. Chrome is auto-detected on macOS/Linux. |

3. **Database** – migrations in `drizzle/` are applied automatically before every
   build (`scripts/migrate.mjs`), including on Vercel. To apply them by hand:

   ```bash
   npm run db:migrate
   ```

   After changing `src/db/schema.ts`, run `npm run db:generate` to add a migration.

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
  db/schema.ts              users, artifacts, artifact_shares, artifact_favorites
  lib/artifacts.ts          Queries + authorization helpers
  lib/artifact-service.ts   Create / update / replace / trash / restore (UI + API + MCP)
  lib/admin.ts              Admin statistics queries
  lib/screenshot.ts         Headless Chrome screenshot (local Chrome or serverless)
  lib/oauth.ts              OAuth 2.1 authorization server + token verification
  lib/mcp-tools.ts          MCP tool definitions
  actions/                  Server actions (sign in/out, update, trash, tokens, consent)
  app/
    page.tsx                Dashboard (My artifacts / Shared with me / Trash)
    upload/                 Upload form
    a/[id]/                 Viewer, raw HTML (logs a view), owner settings
    admin/                  Admin dashboard
    settings/mcp/           MCP connection instructions, personal tokens, connected apps
    oauth/*                 authorize (consent page), token, register, revoke
    .well-known/*           OAuth server + protected-resource metadata
    api/mcp/                MCP endpoint
    api/artifacts/          Create, replace, preview image, regenerate
    api/cron/purge-trash    Daily purge (vercel.json)
```

## Connecting an MCP client

- **claude.ai / Claude Desktop**: Settings → Connectors → Add custom connector → URL
  `https://clever-artifacts.vercel.app/api/mcp`, leave OAuth fields empty, Connect, Allow.
- **Claude Code**: `claude mcp add --transport http clever-artifacts https://clever-artifacts.vercel.app/api/mcp`
  then `/mcp` to sign in, or pass `--header "Authorization: Bearer <personal token>"`.

Tools: `whoami`, `list_artifacts`, `search_artifacts`, `get_artifact`, `get_artifact_html`, `create_artifact`,
`update_artifact`, `replace_artifact_html`, `regenerate_preview`, `favorite_artifact`, `trash_artifact`,
`restore_artifact`, `delete_artifact_permanently`, `list_people`, `admin_overview`.

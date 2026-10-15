import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { adminArtifactsPage, adminOverview } from "@/lib/admin";
import {
  createArtifact,
  deleteForever,
  moveToTrash,
  regeneratePreview,
  replaceArtifactHtml,
  resolveForUser,
  restoreFromTrash,
  ServiceError,
  setFavorite,
  updateArtifact,
} from "@/lib/artifact-service";
import {
  directReportsOf,
  getArtifactForViewer,
  getArtifactHtml,
  listTrash,
  purgeDate,
  queryArtifacts,
  SCOPES,
  SORTS,
  type ArtifactSummary,
} from "@/lib/artifacts";
import { ALLOWED_EMAIL_DOMAIN, TRASH_RETENTION_DAYS } from "@/lib/config";
import type { SessionUser } from "@/lib/session";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function userFrom(ctx: ServerContext): SessionUser {
  const extra = ctx.http?.authInfo?.extra as { user?: SessionUser } | undefined;
  if (!extra?.user) throw new ServiceError("Unauthorized", 401);
  return extra.user;
}

function json(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

function summarize(origin: string, a: ArtifactSummary) {
  return {
    id: a.id,
    slug: a.slug,
    url: `${origin}/a/${a.slug}`,
    title: a.title,
    description: a.description,
    source_url: a.sourceUrl,
    tags: a.tags,
    visibility: a.visibility,
    shared_with_owner_direct_reports: a.shareWithReports || undefined,
    shared_with_you_directly: a.sharedDirectly || undefined,
    shared_with_you_via_your_manager: a.sharedViaReports || undefined,
    favorited: a.favorited || undefined,
    owner: { name: a.ownerName, email: a.ownerEmail },
    size_bytes: a.htmlBytes,
    preview: a.screenshotStatus,
    views: a.viewCount,
    last_viewed_at: a.lastViewedAt,
    trashed_at: a.trashedAt,
    purge_at: a.trashedAt ? purgeDate(a.trashedAt) : undefined,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

const handleArg = z
  .string()
  .min(1)
  .describe("The artifact's slug (from its URL /a/<slug>), its id, or the full URL.");

/** Register every tool on the MCP server. `origin` is used to build URLs. */
export function registerArtifactTools(server: McpServer, origin: string) {
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "The signed-in user this MCP connection acts as.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      try {
        const u = userFrom(ctx);
        const reports = await directReportsOf(u.email);
        return json({
          email: u.email,
          name: u.name,
          is_admin: u.isAdmin,
          app_url: origin,
          direct_reports: reports.map((r) => ({ email: r.email, name: r.name, title: r.title })),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_artifacts",
    {
      title: "List artifacts",
      description:
        "List artifacts. scope=mine (yours), shared (visible to you from others: company-wide or shared directly), favorites (anything you've starred), trash (your trash; admins see everyone's). Optional query and sort; use search_artifacts for the full set of filters.",
      inputSchema: z.object({
        scope: z.enum(["mine", "shared", "favorites", "trash"]).default("mine"),
        query: z.string().optional(),
        sort: z.enum(SORTS).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ scope, query, sort, limit }, ctx) => {
      try {
        const user = userFrom(ctx);
        let rows =
          scope === "trash"
            ? await listTrash(user)
            : scope === "favorites"
              ? await queryArtifacts(user, { scope: "all", favorites: true, q: query, sort, limit: 200 })
              : await queryArtifacts(user, { scope: scope === "mine" ? "mine" : "others", q: query, sort, limit: 200 });
        if (scope === "trash" && query) {
          const q = query.toLowerCase();
          rows = rows.filter((a) =>
            [a.title, a.description ?? "", a.tags.join(" "), a.ownerName ?? "", a.ownerEmail].join(" ").toLowerCase().includes(q),
          );
        }
        return json({
          scope,
          count: rows.length,
          note:
            scope === "trash" ? `Items are deleted permanently ${TRASH_RETENTION_DAYS} days after being trashed.` : undefined,
          artifacts: rows.slice(0, limit).map((a) => summarize(origin, a)),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_artifacts",
    {
      title: "Search artifacts",
      description:
        "Search everything you can open: your own artifacts, ones shared with you directly, and ones open to everyone at the company. Matches title, description, tags and owner; every word must match, and #tag matches a tag exactly. Private artifacts belonging to others are never returned (admins can still open them by id).",
      inputSchema: z.object({
        query: z.string().optional().describe("Words to match; omit to browse with filters only."),
        scope: z.enum(SCOPES).default("all").describe("all | mine | others (anything from others you can see) | direct (shared with you by name) | company (open to everyone)"),
        owner: z.string().optional().describe("Owner's email address."),
        tags: z.array(z.string()).optional().describe("Every listed tag must be present."),
        visibility: z.enum(["private", "domain", "restricted"]).optional(),
        updated_within_days: z.number().int().min(1).max(3650).optional(),
        created_within_days: z.number().int().min(1).max(3650).optional(),
        min_views: z.number().int().min(0).optional(),
        has_preview: z.boolean().optional(),
        favorites_only: z.boolean().optional().describe("Only artifacts you've starred."),
        sort: z.enum(SORTS).optional().describe("Default: relevance when a query is given, otherwise recently updated."),
        limit: z.number().int().min(1).max(200).default(25),
      }),
    },
    async (args, ctx) => {
      try {
        const user = userFrom(ctx);
        const rows = await queryArtifacts(user, {
          q: args.query,
          scope: args.scope,
          owner: args.owner,
          tags: args.tags,
          visibility: args.visibility,
          updatedWithinDays: args.updated_within_days,
          createdWithinDays: args.created_within_days,
          minViews: args.min_views,
          preview: args.has_preview === undefined ? undefined : args.has_preview ? "ready" : "missing",
          favorites: args.favorites_only,
          sort: args.sort,
          limit: args.limit,
        });
        return json({
          query: args.query ?? null,
          count: rows.length,
          artifacts: rows.map((a) => ({ ...summarize(origin, a), yours: a.ownerId === user.id || undefined })),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_artifact",
    {
      title: "Get artifact",
      description: "Metadata for one artifact, including its share list when you own it.",
      inputSchema: z.object({ artifact: handleArg }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        const a = await getArtifactForViewer(id, user);
        if (!a) throw new ServiceError("Artifact not found.", 404);
        return json({
          ...summarize(origin, a),
          can_edit: a.canEdit,
          shared_with: a.canEdit ? a.shares : undefined,
          raw_html_url: `${origin}/a/${a.slug}/raw`,
          download_url: `${origin}/a/${a.slug}/download`,
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_artifact_html",
    {
      title: "Get artifact HTML",
      description: "The full HTML source of an artifact you can view.",
      inputSchema: z.object({ artifact: handleArg }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        const row = await getArtifactHtml(id, user);
        if (!row) throw new ServiceError("Artifact not found.", 404);
        return { content: [{ type: "text", text: row.html }] };
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "create_artifact",
    {
      title: "Upload artifact",
      description:
        `Upload a new HTML artifact (for example a Claude artifact exported as HTML). Private to you by default; set visibility=domain for everyone at ${ALLOWED_EMAIL_DOMAIN}, or visibility=restricted plus share_with for specific people. Returns the artifact's URL. A preview screenshot is generated, which can take ~10 seconds.`,
      inputSchema: z.object({
        html: z.string().min(1).describe("The complete HTML document."),
        title: z.string().optional().describe("Defaults to the document's <title>."),
        slug: z.string().optional().describe("Requested URL handle, e.g. 'q3-renewals'. Spaces become dashes; made unique if taken. Defaults to the title."),
        description: z.string().optional(),
        source_url: z.string().optional().describe("Link back to where this came from, e.g. the Claude conversation."),
        tags: z.array(z.string()).optional(),
        visibility: z.enum(["private", "domain", "restricted"]).optional().describe("private (default): only you. domain: everyone at the company. restricted: only share_with and/or your direct reports."),
        share_with: z.array(z.string()).optional().describe(`@${ALLOWED_EMAIL_DOMAIN} email addresses.`),
        share_with_direct_reports: z.boolean().optional().describe("With visibility=restricted: also everyone who reports to you per the directory (kept current as the team changes)."),
      }),
    },
    async (args, ctx) => {
      try {
        const user = userFrom(ctx);
        const r = await createArtifact(user, {
          html: args.html,
          title: args.title,
          slug: args.slug,
          description: args.description,
          sourceUrl: args.source_url,
          tags: args.tags,
          visibility: args.visibility,
          shares: args.share_with,
          shareWithReports: args.share_with_direct_reports,
        });
        return json({ id: r.id, slug: r.slug, title: r.title, url: `${origin}/a/${r.slug}`, preview_generated: r.screenshotOk });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_artifact",
    {
      title: "Update artifact",
      description:
        "Change an artifact's name, link slug, description, source link, tags, visibility or share list. Only the fields you pass change; pass an empty string to clear description/source_url. share_with replaces the whole list.",
      inputSchema: z.object({
        artifact: handleArg,
        title: z.string().optional(),
        slug: z.string().optional().describe("New URL handle (letters, numbers, dashes). The old link keeps working."),
        description: z.string().optional(),
        source_url: z.string().optional(),
        tags: z.array(z.string()).optional(),
        visibility: z.enum(["private", "domain", "restricted"]).optional(),
        share_with: z.array(z.string()).optional(),
        share_with_direct_reports: z.boolean().optional(),
      }),
    },
    async (args, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(args.artifact);
        const r = await updateArtifact(user, id, {
          title: args.title,
          slug: args.slug,
          description: args.description,
          sourceUrl: args.source_url,
          tags: args.tags,
          visibility: args.visibility,
          shares: args.share_with,
          shareWithReports: args.share_with_direct_reports,
        });
        const a = await getArtifactForViewer(id, user);
        return json({ ok: true, url: `${origin}/a/${r.slug}`, artifact: a ? { ...summarize(origin, a), shared_with: a.shares } : undefined });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "replace_artifact_html",
    {
      title: "Replace artifact HTML",
      description: "Upload a new version of an artifact's HTML. The link stays the same; the preview is regenerated.",
      inputSchema: z.object({ artifact: handleArg, html: z.string().min(1) }),
    },
    async ({ artifact, html }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        const r = await replaceArtifactHtml(user, id, html);
        return json({ ok: true, url: `${origin}/a/${r.slug}`, preview_generated: r.screenshotOk });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "regenerate_preview",
    {
      title: "Regenerate preview",
      description: "Re-take the dashboard screenshot for an artifact you own.",
      inputSchema: z.object({ artifact: handleArg }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        return json(await regeneratePreview(user, id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "favorite_artifact",
    {
      title: "Star / unstar artifact",
      description:
        "Add an artifact you can open to your favorites (or remove it). Favorites are personal: they show under the Favorites tab on your dashboard and never affect anyone else.",
      inputSchema: z.object({ artifact: handleArg, favorited: z.boolean().default(true).describe("false to unstar.") }),
    },
    async ({ artifact, favorited }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        return json({ ok: true, ...(await setFavorite(user, id, favorited)) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "trash_artifact",
    {
      title: "Move to trash",
      description: `Move an artifact you own to the trash. It stops being visible to others and is deleted permanently after ${TRASH_RETENTION_DAYS} days unless restored.`,
      inputSchema: z.object({ artifact: handleArg }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        const r = await moveToTrash(user, id);
        return json({ ok: true, ...r, purge_after_days: TRASH_RETENTION_DAYS });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "restore_artifact",
    {
      title: "Restore from trash",
      description: "Bring a trashed artifact back.",
      inputSchema: z.object({ artifact: handleArg }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        return json({ ok: true, ...(await restoreFromTrash(user, id)) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_artifact_permanently",
    {
      title: "Delete permanently",
      description: "Immediately and irreversibly delete an artifact you own, including its share list and view history.",
      inputSchema: z.object({ artifact: handleArg, confirm: z.literal(true).describe("Must be true.") }),
    },
    async ({ artifact }, ctx) => {
      try {
        const user = userFrom(ctx);
        const id = await resolveForUser(artifact);
        return json({ ok: true, ...(await deleteForever(user, id)) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_people",
    {
      title: "List people",
      description: "People at the company (from sign-ins and the employee directory), for building share lists. Matches name, email, title or department.",
      inputSchema: z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }),
    },
    async ({ query, limit }, ctx) => {
      try {
        const user = userFrom(ctx);
        const q = (query ?? "").trim();
        const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        const rows = await db
          .select({ email: users.email, name: users.name, title: users.title, department: users.department, lastLoginAt: users.lastLoginAt })
          .from(users)
          .where(q ? or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.title, pattern), ilike(users.department, pattern)) : ne(users.id, ""))
          .orderBy(users.name, users.email)
          .limit(limit);
        return json({ count: rows.length, people: rows, you: user.email });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "admin_overview",
    {
      title: "Admin overview",
      description: "Admins only: usage totals and per-artifact view statistics across the whole app.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(500).default(100) }),
    },
    async ({ limit }, ctx) => {
      try {
        const user = userFrom(ctx);
        if (!user.isAdmin) throw new ServiceError("Admins only.", 403);
        const [overview, { rows, total }] = await Promise.all([adminOverview(), adminArtifactsPage({ sort: "views", page: 1 })]);
        return json({
          overview,
          total_artifacts: total,
          artifacts: rows.slice(0, limit).map((r) => ({
            title: r.title,
            url: `${origin}/a/${r.slug}`,
            owner: r.ownerEmail,
            visibility: r.visibility,
            shares: r.shareCount,
            views: r.viewCount,
            unique_viewers: r.uniqueViewers,
            views_last_7d: r.views7d,
            last_viewed_at: r.lastViewedAt,
            trashed_at: r.trashedAt,
            created_at: r.createdAt,
          })),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );
}

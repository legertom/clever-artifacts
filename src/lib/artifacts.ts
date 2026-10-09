import { and, asc, desc, eq, exists, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  artifactAliases,
  artifactShares,
  artifactViews,
  artifacts,
  users,
  type ArtifactVisibility,
} from "@/db/schema";
import { LIMITS, TRASH_RETENTION_DAYS, isAllowedEmail, normalizeEmail } from "@/lib/config";
import type { SessionUser } from "@/lib/session";
import { isValidSlug, slugify } from "@/lib/slug";

/** Columns safe to return in lists (never the HTML or screenshot blobs). */
const summaryColumns = {
  id: artifacts.id,
  slug: artifacts.slug,
  title: artifacts.title,
  description: artifacts.description,
  sourceUrl: artifacts.sourceUrl,
  tags: artifacts.tags,
  visibility: artifacts.visibility,
  htmlBytes: artifacts.htmlBytes,
  screenshotStatus: artifacts.screenshotStatus,
  viewCount: artifacts.viewCount,
  lastViewedAt: artifacts.lastViewedAt,
  trashedAt: artifacts.trashedAt,
  createdAt: artifacts.createdAt,
  updatedAt: artifacts.updatedAt,
  ownerId: artifacts.ownerId,
  ownerName: users.name,
  ownerEmail: users.email,
  ownerImage: users.image,
};

export type ArtifactSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  tags: string[];
  visibility: ArtifactVisibility;
  htmlBytes: number;
  screenshotStatus: "pending" | "ready" | "failed";
  viewCount: number;
  lastViewedAt: Date | null;
  trashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  ownerImage: string | null;
  /** True when the viewer was added to the share list explicitly. */
  sharedDirectly: boolean;
};

export type ArtifactDetail = ArtifactSummary & {
  shares: string[];
  /** Owner or admin: may edit, share, trash. */
  canEdit: boolean;
  isOwner: boolean;
};

function sharedWithEmail(email: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(artifactShares)
      .where(and(eq(artifactShares.artifactId, artifacts.id), eq(artifactShares.email, email))),
  );
}

/**
 * private    → owner only (admins included out; they see it listed in /admin but can't open it).
 * domain     → any signed-in person; restricted → explicit share list.
 * Trashed artifacts are visible only to the owner (and admins, for non-private ones).
 */
function canView(
  row: { ownerId: string; visibility: ArtifactVisibility; trashedAt: Date | null; sharedDirectly: boolean },
  user: SessionUser,
): boolean {
  if (row.ownerId === user.id) return true;
  if (row.visibility === "private") return false;
  if (user.isAdmin) return true;
  if (row.trashedAt) return false;
  return row.visibility === "domain" || row.sharedDirectly;
}

export function purgeDate(trashedAt: Date): Date {
  return new Date(trashedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function listMine(user: SessionUser): Promise<ArtifactSummary[]> {
  return db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`false` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(and(eq(artifacts.ownerId, user.id), isNull(artifacts.trashedAt)))
    .orderBy(desc(artifacts.updatedAt));
}

/** Artifacts owned by others that this user can open: domain-wide ones plus explicit shares. */
export async function listSharedWithMe(user: SessionUser): Promise<ArtifactSummary[]> {
  const direct = sharedWithEmail(normalizeEmail(user.email));
  return db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`${direct}` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(
      and(
        ne(artifacts.ownerId, user.id),
        isNull(artifacts.trashedAt),
        or(eq(artifacts.visibility, "domain"), direct),
      ),
    )
    .orderBy(desc(artifacts.updatedAt));
}

/** Trashed artifacts: your own, or everyone's for admins. */
export async function listTrash(user: SessionUser): Promise<ArtifactSummary[]> {
  return db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`false` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(
      and(isNotNull(artifacts.trashedAt), user.isAdmin ? undefined : eq(artifacts.ownerId, user.id)),
    )
    .orderBy(asc(artifacts.trashedAt));
}

// ---------------------------------------------------------------------------
// Lookup by slug / alias / id
// ---------------------------------------------------------------------------

export type Resolved = { id: string; slug: string; canonical: boolean };

/** Turn whatever is in the URL into an artifact id. `canonical` is false when the caller should redirect to /a/<slug>. */
export async function resolveHandle(handle: string): Promise<Resolved | null> {
  const h = handle.trim();
  if (!h) return null;

  const [bySlug] = await db
    .select({ id: artifacts.id, slug: artifacts.slug })
    .from(artifacts)
    .where(eq(artifacts.slug, h))
    .limit(1);
  if (bySlug) return { ...bySlug, canonical: true };

  const [byAlias] = await db
    .select({ id: artifacts.id, slug: artifacts.slug })
    .from(artifactAliases)
    .innerJoin(artifacts, eq(artifacts.id, artifactAliases.artifactId))
    .where(eq(artifactAliases.slug, h))
    .limit(1);
  if (byAlias) return { ...byAlias, canonical: false };

  const [byId] = await db
    .select({ id: artifacts.id, slug: artifacts.slug })
    .from(artifacts)
    .where(eq(artifacts.id, h))
    .limit(1);
  if (byId) return { ...byId, canonical: false };

  return null;
}

/** Metadata for one artifact, or null when it doesn't exist or the user may not see it. */
export async function getArtifactForViewer(id: string, user: SessionUser): Promise<ArtifactDetail | null> {
  const email = normalizeEmail(user.email);
  const [row] = await db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`${sharedWithEmail(email)}` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row || !canView(row, user)) return null;

  const isOwner = row.ownerId === user.id;
  const canEdit = isOwner || user.isAdmin;
  const shares = canEdit
    ? (
        await db
          .select({ email: artifactShares.email })
          .from(artifactShares)
          .where(eq(artifactShares.artifactId, id))
          .orderBy(artifactShares.email)
      ).map((s) => s.email)
    : [];

  return { ...row, shares, canEdit, isOwner };
}

/** Raw HTML for one artifact, or null when not found / not permitted. */
export async function getArtifactHtml(id: string, user: SessionUser) {
  const email = normalizeEmail(user.email);
  const [row] = await db
    .select({
      id: artifacts.id,
      title: artifacts.title,
      ownerId: artifacts.ownerId,
      visibility: artifacts.visibility,
      trashedAt: artifacts.trashedAt,
      html: artifacts.html,
      updatedAt: artifacts.updatedAt,
      sharedDirectly: sql<boolean>`${sharedWithEmail(email)}`,
    })
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row || !canView(row, user)) return null;
  return row;
}

/** Screenshot for one artifact, or null when not found / not permitted. */
export async function getArtifactScreenshot(id: string, user: SessionUser) {
  const email = normalizeEmail(user.email);
  const [row] = await db
    .select({
      ownerId: artifacts.ownerId,
      visibility: artifacts.visibility,
      trashedAt: artifacts.trashedAt,
      screenshot: artifacts.screenshot,
      screenshotStatus: artifacts.screenshotStatus,
      updatedAt: artifacts.updatedAt,
      sharedDirectly: sql<boolean>`${sharedWithEmail(email)}`,
    })
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row || !canView(row, user)) return null;
  return row;
}

const editableColumns = {
  id: artifacts.id,
  slug: artifacts.slug,
  title: artifacts.title,
  ownerId: artifacts.ownerId,
  visibility: artifacts.visibility,
  trashedAt: artifacts.trashedAt,
};

/** Lookup used by content/sharing mutations: the owner, or an admin for anything not private. */
export async function getEditableArtifact(id: string, user: SessionUser) {
  const [row] = await db.select(editableColumns).from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!row) return null;
  if (row.ownerId === user.id) return row;
  if (user.isAdmin && row.visibility !== "private") return row;
  return null;
}

/** Lookup used by trash / restore / delete: the owner, or an admin for anything (moderation). */
export async function getModeratableArtifact(id: string, user: SessionUser) {
  const [row] = await db.select(editableColumns).from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!row) return null;
  return row.ownerId === user.id || user.isAdmin ? row : null;
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse a share list typed by a user. Returns the clean, de-duplicated emails
 * and any entries that were rejected (wrong domain / malformed).
 */
export function parseShareEmails(
  raw: string | string[] | null | undefined,
  ownerEmail: string,
): { emails: string[]; rejected: string[] } {
  const parts = (Array.isArray(raw) ? raw : (raw ?? "").split(/[\s,;]+/))
    .map(normalizeEmail)
    .filter(Boolean);
  const owner = normalizeEmail(ownerEmail);
  const emails = new Set<string>();
  const rejected: string[] = [];
  for (const p of parts) {
    if (p === owner) continue; // the owner always has access
    if (isAllowedEmail(p) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) emails.add(p);
    else rejected.push(p);
  }
  return { emails: [...emails].sort(), rejected };
}

/** Lower-case, de-duplicate and cap a tag list. */
export function parseTags(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : (raw ?? "").split(/[,\n]+/);
  const out = new Set<string>();
  for (const p of parts) {
    const t = p.trim().toLowerCase().replace(/\s+/g, " ").slice(0, LIMITS.tagLength);
    if (t) out.add(t);
    if (out.size >= LIMITS.tags) break;
  }
  return [...out];
}

/** Accept http(s) links only; returns null for anything else. */
export function parseSourceUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().slice(0, LIMITS.sourceUrl);
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Replace the share list for an artifact. */
export async function setShares(artifactId: string, emails: string[]) {
  await db.delete(artifactShares).where(eq(artifactShares.artifactId, artifactId));
  if (emails.length) {
    await db
      .insert(artifactShares)
      .values(emails.map((email) => ({ artifactId, email })))
      .onConflictDoNothing();
  }
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const [a] = await db
    .select({ id: artifacts.id })
    .from(artifacts)
    .where(and(eq(artifacts.slug, slug), excludeId ? ne(artifacts.id, excludeId) : undefined))
    .limit(1);
  if (a) return true;
  const [al] = await db
    .select({ id: artifactAliases.artifactId })
    .from(artifactAliases)
    .where(and(eq(artifactAliases.slug, slug), excludeId ? ne(artifactAliases.artifactId, excludeId) : undefined))
    .limit(1);
  return Boolean(al);
}

/** A slug nobody else is using, derived from `base` (a title or a user-typed handle). */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "artifact";
  if (!(await slugTaken(root, excludeId))) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!(await slugTaken(candidate, excludeId))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export type SlugChange = { ok: true; slug: string } | { ok: false; error: string };

/** Validate and apply a user-chosen slug, keeping the old one as an alias. */
export async function changeSlug(artifactId: string, currentSlug: string, requested: string): Promise<SlugChange> {
  const next = slugify(requested);
  if (!next || !isValidSlug(next)) {
    return { ok: false, error: "Use letters, numbers and dashes for the link." };
  }
  if (next === currentSlug) return { ok: true, slug: currentSlug };
  if (await slugTaken(next, artifactId)) {
    return { ok: false, error: `“${next}” is already used by another artifact.` };
  }
  await db.update(artifacts).set({ slug: next }).where(eq(artifacts.id, artifactId));
  // Reclaiming one of our own old slugs? Drop it from the alias list.
  await db.delete(artifactAliases).where(eq(artifactAliases.slug, next));
  await db
    .insert(artifactAliases)
    .values({ slug: currentSlug, artifactId })
    .onConflictDoNothing();
  return { ok: true, slug: next };
}

export async function recordView(artifactId: string, userId: string) {
  const now = new Date();
  await db.insert(artifactViews).values({ artifactId, userId, viewedAt: now });
  await db
    .update(artifacts)
    .set({ viewCount: sql`${artifacts.viewCount} + 1`, lastViewedAt: now })
    .where(eq(artifacts.id, artifactId));
}

export async function trashArtifact(artifactId: string, user: SessionUser) {
  await db
    .update(artifacts)
    .set({ trashedAt: new Date(), trashedBy: user.id })
    .where(eq(artifacts.id, artifactId));
}

export async function restoreArtifact(artifactId: string) {
  await db
    .update(artifacts)
    .set({ trashedAt: null, trashedBy: null })
    .where(eq(artifacts.id, artifactId));
}

/** Hard-delete everything that has sat in the trash past the retention window. Returns the count. */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(artifacts)
    .where(and(isNotNull(artifacts.trashedAt), lt(artifacts.trashedAt, cutoff)))
    .returning({ id: artifacts.id });
  return rows.length;
}

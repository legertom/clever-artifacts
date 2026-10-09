import { and, desc, eq, exists, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifactShares, artifacts, users, type ArtifactVisibility } from "@/db/schema";
import { isAllowedEmail, normalizeEmail } from "@/lib/config";
import type { SessionUser } from "@/lib/session";

/** Columns safe to return in lists (never the HTML or screenshot blobs). */
const summaryColumns = {
  id: artifacts.id,
  title: artifacts.title,
  visibility: artifacts.visibility,
  htmlBytes: artifacts.htmlBytes,
  screenshotStatus: artifacts.screenshotStatus,
  createdAt: artifacts.createdAt,
  updatedAt: artifacts.updatedAt,
  ownerId: artifacts.ownerId,
  ownerName: users.name,
  ownerEmail: users.email,
  ownerImage: users.image,
};

export type ArtifactSummary = {
  id: string;
  title: string;
  visibility: ArtifactVisibility;
  htmlBytes: number;
  screenshotStatus: "pending" | "ready" | "failed";
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  ownerImage: string | null;
  /** True when the viewer was added to the share list explicitly. */
  sharedDirectly: boolean;
};

function sharedWithEmail(email: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(artifactShares)
      .where(and(eq(artifactShares.artifactId, artifacts.id), eq(artifactShares.email, email))),
  );
}

export async function listMine(user: SessionUser): Promise<ArtifactSummary[]> {
  const rows = await db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`false` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(eq(artifacts.ownerId, user.id))
    .orderBy(desc(artifacts.updatedAt));
  return rows;
}

/** Artifacts owned by others that this user can open: domain-wide ones plus explicit shares. */
export async function listSharedWithMe(user: SessionUser): Promise<ArtifactSummary[]> {
  const email = normalizeEmail(user.email);
  const direct = sharedWithEmail(email);
  const rows = await db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`${direct}` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(and(ne(artifacts.ownerId, user.id), or(eq(artifacts.visibility, "domain"), direct)))
    .orderBy(desc(artifacts.updatedAt));
  return rows;
}

export type ArtifactDetail = ArtifactSummary & {
  shares: string[];
  isOwner: boolean;
};

/** Metadata for one artifact, or null when it doesn't exist or the user may not see it. */
export async function getArtifactForViewer(
  id: string,
  user: SessionUser,
): Promise<ArtifactDetail | null> {
  const email = normalizeEmail(user.email);
  const [row] = await db
    .select({ ...summaryColumns, sharedDirectly: sql<boolean>`${sharedWithEmail(email)}` })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row) return null;

  const isOwner = row.ownerId === user.id;
  if (!isOwner && row.visibility !== "domain" && !row.sharedDirectly) return null;

  const shares = isOwner
    ? (
        await db
          .select({ email: artifactShares.email })
          .from(artifactShares)
          .where(eq(artifactShares.artifactId, id))
          .orderBy(artifactShares.email)
      ).map((s) => s.email)
    : [];

  return { ...row, shares, isOwner };
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
      html: artifacts.html,
      updatedAt: artifacts.updatedAt,
      sharedDirectly: sql<boolean>`${sharedWithEmail(email)}`,
    })
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row) return null;
  if (row.ownerId !== user.id && row.visibility !== "domain" && !row.sharedDirectly) return null;
  return row;
}

/** Screenshot for one artifact, or null when not found / not permitted. */
export async function getArtifactScreenshot(id: string, user: SessionUser) {
  const email = normalizeEmail(user.email);
  const [row] = await db
    .select({
      ownerId: artifacts.ownerId,
      visibility: artifacts.visibility,
      screenshot: artifacts.screenshot,
      screenshotStatus: artifacts.screenshotStatus,
      updatedAt: artifacts.updatedAt,
      sharedDirectly: sql<boolean>`${sharedWithEmail(email)}`,
    })
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1);
  if (!row) return null;
  if (row.ownerId !== user.id && row.visibility !== "domain" && !row.sharedDirectly) return null;
  return row;
}

/** Owner-only lookup used by mutations. */
export async function getOwnedArtifact(id: string, user: SessionUser) {
  const [row] = await db
    .select({
      id: artifacts.id,
      title: artifacts.title,
      ownerId: artifacts.ownerId,
      visibility: artifacts.visibility,
    })
    .from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.ownerId, user.id)))
    .limit(1);
  return row ?? null;
}

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

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import {
  changeSlug,
  getEditableArtifact,
  getModeratableArtifact,
  parseShareEmails,
  parseSourceUrl,
  parseTags,
  resolveHandle,
  restoreArtifact,
  setShares,
  trashArtifact,
  uniqueSlug,
} from "@/lib/artifacts";
import { LIMITS, MAX_HTML_BYTES } from "@/lib/config";
import { generateAndStoreScreenshot } from "@/lib/generate-screenshot";
import { extractTitle, looksLikeHtml } from "@/lib/html";
import type { SessionUser } from "@/lib/session";
import { slugify } from "@/lib/slug";

/**
 * Operations shared by the web UI, the upload API and the MCP server. Every
 * function takes the acting user and enforces ownership itself.
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export type CreateInput = {
  html: string;
  title?: string | null;
  /** Requested link handle; normalised, made unique. Defaults to the title. */
  slug?: string | null;
  fileName?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  tags?: string | string[] | null;
  visibility?: string | null;
  shares?: string | string[] | null;
  /** Share with everyone whose manager is the owner (directory). Only meaningful for restricted. */
  shareWithReports?: boolean | null;
};

export type Visibility = "private" | "domain" | "restricted";

/** Normalise user input; null when unrecognised so callers can pick a default. */
export function parseVisibility(raw: string | null | undefined): Visibility | null {
  return raw === "private" || raw === "domain" || raw === "restricted" ? raw : null;
}

function validateHtml(html: string) {
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new ServiceError(`File is too large (max ${Math.round(MAX_HTML_BYTES / 1024 / 1024)} MB)`, 413);
  }
  if (!html.trim() || !looksLikeHtml(html)) {
    throw new ServiceError("That doesn't look like an HTML document", 400);
  }
}

export async function createArtifact(user: SessionUser, input: CreateInput) {
  validateHtml(input.html);
  const title =
    (input.title ?? "").trim().slice(0, LIMITS.title) ||
    extractTitle(input.html) ||
    (input.fileName ?? "").replace(/\.html?$/i, "").trim() ||
    "Untitled artifact";
  const visibility = parseVisibility(input.visibility) ?? "private";
  const { emails, rejected } = parseShareEmails(input.shares, user.email);
  if (rejected.length) {
    throw new ServiceError(`These addresses can't be shared with: ${rejected.join(", ")}`, 400);
  }
  const shareWithReports = visibility === "restricted" && Boolean(input.shareWithReports);
  if (visibility === "restricted" && emails.length === 0 && !shareWithReports) {
    throw new ServiceError("Add at least one person or your direct reports, or pick another visibility.", 400);
  }

  const id = nanoid(12);
  const requestedSlug = slugify(input.slug ?? "");
  const slug = await uniqueSlug(requestedSlug || title);
  await db.insert(artifacts).values({
    id,
    slug,
    ownerId: user.id,
    title,
    description: (input.description ?? "").trim().slice(0, LIMITS.description) || null,
    sourceUrl: parseSourceUrl(input.sourceUrl),
    tags: parseTags(input.tags),
    visibility,
    shareWithReports,
    html: input.html,
    htmlBytes: Buffer.byteLength(input.html, "utf8"),
  });
  await setShares(id, emails);
  const screenshotOk = await generateAndStoreScreenshot(id, input.html);
  return { id, slug, title, screenshotOk };
}

export type UpdateInput = {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  tags?: string | string[] | null;
  visibility?: string | null;
  shares?: string | string[] | null;
  shareWithReports?: boolean | null;
};

/** Update metadata/sharing. Only provided fields change (null clears optional ones). */
export async function updateArtifact(user: SessionUser, id: string, input: UpdateInput) {
  const owned = await getEditableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);

  const patch: Partial<typeof artifacts.$inferInsert> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    const title = (input.title ?? "").trim().slice(0, LIMITS.title);
    if (!title) throw new ServiceError("Give the artifact a name.", 400);
    patch.title = title;
  }
  if (input.description !== undefined) {
    patch.description = (input.description ?? "").trim().slice(0, LIMITS.description) || null;
  }
  if (input.sourceUrl !== undefined) {
    const raw = (input.sourceUrl ?? "").trim();
    const parsed = parseSourceUrl(raw);
    if (raw && !parsed) throw new ServiceError("Source link must be an http(s) URL.", 400);
    patch.sourceUrl = parsed;
  }
  if (input.tags !== undefined) patch.tags = parseTags(input.tags);

  const visibility = parseVisibility(input.visibility) ?? owned.visibility;
  patch.visibility = visibility;
  const shareWithReports =
    visibility === "restricted" &&
    (input.shareWithReports === undefined || input.shareWithReports === null ? owned.shareWithReports : Boolean(input.shareWithReports));
  patch.shareWithReports = shareWithReports;

  let emails: string[] | null = null;
  if (input.shares !== undefined) {
    const parsed = parseShareEmails(input.shares, user.email);
    if (parsed.rejected.length) {
      throw new ServiceError(`These addresses can't be shared with: ${parsed.rejected.join(", ")}`, 400);
    }
    emails = parsed.emails;
    if (visibility === "restricted" && emails.length === 0 && !shareWithReports) {
      throw new ServiceError("Add at least one person or your direct reports, or pick another visibility.", 400);
    }
  }

  await db.update(artifacts).set(patch).where(eq(artifacts.id, id));
  if (emails) await setShares(id, emails);

  let slug = owned.slug;
  if (input.slug !== undefined && input.slug !== null && input.slug.trim()) {
    const res = await changeSlug(id, owned.slug, input.slug);
    if (!res.ok) throw new ServiceError(res.error, 400);
    slug = res.slug;
  }
  return { id, slug };
}

export async function replaceArtifactHtml(user: SessionUser, id: string, html: string) {
  const owned = await getEditableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);
  validateHtml(html);
  await db
    .update(artifacts)
    .set({
      html,
      htmlBytes: Buffer.byteLength(html, "utf8"),
      screenshotStatus: "pending",
      screenshotError: null,
      updatedAt: new Date(),
    })
    .where(eq(artifacts.id, id));
  const screenshotOk = await generateAndStoreScreenshot(id, html);
  return { id, slug: owned.slug, screenshotOk };
}

export async function regeneratePreview(user: SessionUser, id: string) {
  const owned = await getEditableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);
  const [row] = await db.select({ html: artifacts.html }).from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!row) throw new ServiceError("Artifact not found.", 404);
  await db
    .update(artifacts)
    .set({ screenshotStatus: "pending", screenshotError: null })
    .where(eq(artifacts.id, id));
  const ok = await generateAndStoreScreenshot(id, row.html);
  if (!ok) {
    const [after] = await db
      .select({ error: artifacts.screenshotError })
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1);
    throw new ServiceError(after?.error ?? "Preview generation failed", 500);
  }
  return { ok: true as const };
}

export async function moveToTrash(user: SessionUser, id: string) {
  const owned = await getModeratableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);
  if (!owned.trashedAt) await trashArtifact(id, user);
  return { id, slug: owned.slug };
}

export async function restoreFromTrash(user: SessionUser, id: string) {
  const owned = await getModeratableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);
  if (owned.trashedAt) await restoreArtifact(id);
  return { id, slug: owned.slug };
}

export async function deleteForever(user: SessionUser, id: string) {
  const owned = await getModeratableArtifact(id, user);
  if (!owned) throw new ServiceError("Artifact not found.", 404);
  await db.delete(artifacts).where(eq(artifacts.id, id));
  return { id };
}

/** Accepts a slug, an id, or a full /a/<handle> URL. */
export async function resolveForUser(handle: string): Promise<string> {
  let h = handle.trim();
  const m = /\/a\/([^/?#]+)/.exec(h);
  if (m) h = decodeURIComponent(m[1]);
  const r = await resolveHandle(h);
  if (!r) throw new ServiceError("Artifact not found.", 404);
  return r.id;
}

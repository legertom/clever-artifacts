import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,

  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,

  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { artifactShares, artifactViews, artifacts, users } from "@/db/schema";
import { ADMIN_EMAILS, isAllowedEmail, normalizeEmail } from "@/lib/config";

const DAY = 24 * 60 * 60 * 1000;
export const ADMIN_PAGE_SIZE = 50;

function likePattern(term: string): string {
  return `%${term.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

function pageWindow(page: number, pageSize = ADMIN_PAGE_SIZE) {
  const p = Math.max(1, Math.floor(page || 1));
  return { limit: pageSize, offset: (p - 1) * pageSize, page: p };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function adminOverview() {
  const since7d = new Date(Date.now() - 7 * DAY);
  const since30d = new Date(Date.now() - 30 * DAY);

  const [[artifactCounts], [userCounts], [viewTotals], [views7d], [views30d], [activeUsers7d]] = await Promise.all([
    db
      .select({
        active: count(sql`case when ${artifacts.trashedAt} is null then 1 end`),
        trashed: count(sql`case when ${artifacts.trashedAt} is not null then 1 end`),
        bytes: sql<number>`coalesce(sum(${artifacts.htmlBytes}), 0)::bigint`,
      })
      .from(artifacts),
    db
      .select({
        signedIn: count(sql`case when ${users.lastLoginAt} is not null then 1 end`),
        total: count(),
      })
      .from(users),
    db.select({ views: count(), viewers: countDistinct(artifactViews.userId) }).from(artifactViews),
    db.select({ n: count() }).from(artifactViews).where(gte(artifactViews.viewedAt, since7d)),
    db.select({ n: count() }).from(artifactViews).where(gte(artifactViews.viewedAt, since30d)),
    db.select({ n: countDistinct(artifactViews.userId) }).from(artifactViews).where(gte(artifactViews.viewedAt, since7d)),
  ]);

  return {
    artifactsActive: artifactCounts.active,
    artifactsTrashed: artifactCounts.trashed,
    totalBytes: Number(artifactCounts.bytes),
    users: userCounts.signedIn,
    usersTotal: userCounts.total,
    views: viewTotals.views,
    uniqueViewers: viewTotals.viewers,
    views7d: views7d.n,
    views30d: views30d.n,
    activeUsers7d: activeUsers7d.n,
  };
}

/** Views per day for the last `days` days, oldest first. */
export async function adminViewsPerDay(days = 30): Promise<{ day: string; views: number }[]> {
  const since = new Date(Date.now() - (days - 1) * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${artifactViews.viewedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      views: count(),
    })
    .from(artifactViews)
    .where(gte(artifactViews.viewedAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, r.views]));
  const out: { day: string; views: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * DAY).toISOString().slice(0, 10);
    out.push({ day: d, views: byDay.get(d) ?? 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Artifacts (paginated)
// ---------------------------------------------------------------------------

export const ARTIFACT_STATUS = ["all", "active", "trash"] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUS)[number];
export const ADMIN_ARTIFACT_SORTS = {
  views: "Most viewed",
  views7d: "Most viewed, 7 days",
  updated: "Recently updated",
  created: "Newest",
  title: "Name A→Z",
  size: "Largest",
  owner: "Owner A→Z",
  last_viewed: "Recently viewed",
} as const;
export type AdminArtifactSort = keyof typeof ADMIN_ARTIFACT_SORTS;

export type AdminArtifactRow = {
  id: string;
  slug: string;
  title: string;
  visibility: "private" | "domain" | "restricted";
  shareWithReports: boolean;
  htmlBytes: number;
  screenshotStatus: "pending" | "ready" | "failed";
  viewCount: number;
  lastViewedAt: Date | null;
  trashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerName: string | null;
  ownerEmail: string;
  ownerImage: string | null;
  shareCount: number;
  uniqueViewers: number;
  views7d: number;
};

export type ArtifactsPageQuery = {
  q?: string;
  status?: ArtifactStatus;
  visibility?: "private" | "domain" | "restricted";
  sort?: AdminArtifactSort;
  page?: number;
};

export async function adminArtifactsPage(query: ArtifactsPageQuery): Promise<{ rows: AdminArtifactRow[]; total: number; page: number }> {
  const since7d = new Date(Date.now() - 7 * DAY);
  const { limit, offset, page } = pageWindow(query.page ?? 1);

  const conditions: (SQL | undefined)[] = [];
  if (query.status === "active") conditions.push(isNull(artifacts.trashedAt));
  if (query.status === "trash") conditions.push(isNotNull(artifacts.trashedAt));
  if (query.visibility) conditions.push(eq(artifacts.visibility, query.visibility));
  if (query.q?.trim()) {
    const pat = likePattern(query.q);
    conditions.push(
      or(ilike(artifacts.title, pat), ilike(artifacts.slug, pat), ilike(users.name, pat), ilike(users.email, pat), sql`array_to_string(${artifacts.tags}, ' ') ilike ${pat}`),
    );
  }
  const where = and(...conditions.filter((c): c is SQL => Boolean(c)));

  const shareCounts = db
    .select({ artifactId: artifactShares.artifactId, shareN: count().as("share_n") })
    .from(artifactShares)
    .groupBy(artifactShares.artifactId)
    .as("share_counts");
  const viewStats = db
    .select({
      artifactId: artifactViews.artifactId,
      viewers: countDistinct(artifactViews.userId).as("view_viewers"),
      recent: count(sql`case when ${artifactViews.viewedAt} >= ${since7d} then 1 end`).as("view_recent"),
    })
    .from(artifactViews)
    .groupBy(artifactViews.artifactId)
    .as("view_stats");

  const orderBy: Record<AdminArtifactSort, SQL[]> = {
    views: [desc(artifacts.viewCount), desc(artifacts.updatedAt)],
    views7d: [sql`coalesce(${viewStats.recent}, 0) desc`, desc(artifacts.viewCount)],
    updated: [desc(artifacts.updatedAt)],
    created: [desc(artifacts.createdAt)],
    title: [asc(sql`lower(${artifacts.title})`)],
    size: [desc(artifacts.htmlBytes)],
    owner: [asc(sql`lower(coalesce(${users.name}, ${users.email}))`), desc(artifacts.updatedAt)],
    last_viewed: [sql`${artifacts.lastViewedAt} desc nulls last`],
  };

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: artifacts.id,
        slug: artifacts.slug,
        title: artifacts.title,
        visibility: artifacts.visibility,
        shareWithReports: artifacts.shareWithReports,
        htmlBytes: artifacts.htmlBytes,
        screenshotStatus: artifacts.screenshotStatus,
        viewCount: artifacts.viewCount,
        lastViewedAt: artifacts.lastViewedAt,
        trashedAt: artifacts.trashedAt,
        createdAt: artifacts.createdAt,
        updatedAt: artifacts.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerImage: users.image,
        shareCount: sql<number>`coalesce(${shareCounts.shareN}, 0)::int`,
        uniqueViewers: sql<number>`coalesce(${viewStats.viewers}, 0)::int`,
        views7d: sql<number>`coalesce(${viewStats.recent}, 0)::int`,
      })
      .from(artifacts)
      .innerJoin(users, eq(users.id, artifacts.ownerId))
      .leftJoin(shareCounts, eq(shareCounts.artifactId, artifacts.id))
      .leftJoin(viewStats, eq(viewStats.artifactId, artifacts.id))
      .where(where)
      .orderBy(...orderBy[query.sort ?? "views"])
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(artifacts).innerJoin(users, eq(users.id, artifacts.ownerId)).where(where),
  ]);
  return { rows, total, page };
}

/** Top artifacts by views in the last 7 days (overview). */
export async function adminTopArtifacts(limit = 8) {
  const { rows } = await adminArtifactsPage({ status: "active", sort: "views7d", page: 1 });
  return rows.slice(0, limit);
}

// ---------------------------------------------------------------------------
// People (paginated)
// ---------------------------------------------------------------------------

export const PEOPLE_FILTERS = ["all", "signed_in", "directory", "managers", "admins"] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number];
export const PEOPLE_FILTER_LABELS: Record<PeopleFilter, string> = {
  all: "Everyone",
  signed_in: "Signed in",
  directory: "Not signed in yet",
  managers: "Managers",
  admins: "Admins",
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  title: string | null;
  department: string | null;
  managerEmail: string | null;
  managerName: string | null;
  /** Promoted from this page. People in ADMIN_EMAILS are admins whatever this says. */
  isAdmin: boolean;
  reportCount: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  artifactsOwned: number;
  viewsMade: number;
  lastViewAt: Date | null;
};

export type PeoplePageQuery = { q?: string; filter?: PeopleFilter; page?: number };

export async function adminPeoplePage(query: PeoplePageQuery): Promise<{ rows: AdminUserRow[]; total: number; page: number }> {
  const { limit, offset, page } = pageWindow(query.page ?? 1);
  const manager = alias(users, "manager");
  const reports = alias(users, "reports");

  const conditions: (SQL | undefined)[] = [];
  if (query.filter === "signed_in") conditions.push(isNotNull(users.lastLoginAt));
  if (query.filter === "directory") conditions.push(isNull(users.lastLoginAt));
  if (query.filter === "admins") {
    conditions.push(ADMIN_EMAILS.size ? or(eq(users.isAdmin, true), inArray(users.email, [...ADMIN_EMAILS])) : eq(users.isAdmin, true));
  }
  if (query.filter === "managers") {
    conditions.push(exists(db.select({ one: sql`1` }).from(reports).where(eq(reports.managerEmail, users.email))));
  }
  if (query.q?.trim()) {
    const pat = likePattern(query.q);
    conditions.push(
      or(ilike(users.name, pat), ilike(users.email, pat), ilike(users.title, pat), ilike(users.department, pat), ilike(users.managerEmail, pat), ilike(manager.name, pat)),
    );
  }
  const where = and(...conditions.filter((c): c is SQL => Boolean(c)));

  const owned = db
    .select({ ownerId: artifacts.ownerId, ownedN: count().as("owned_n") })
    .from(artifacts)
    .where(isNull(artifacts.trashedAt))
    .groupBy(artifacts.ownerId)
    .as("owned");
  const viewed = db
    .select({ userId: artifactViews.userId, viewedN: count().as("viewed_n"), last: max(artifactViews.viewedAt).as("viewed_last") })
    .from(artifactViews)
    .groupBy(artifactViews.userId)
    .as("viewed");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        title: users.title,
        department: users.department,
        managerEmail: users.managerEmail,
        managerName: manager.name,
        isAdmin: users.isAdmin,
        reportCount: sql<number>`(select count(*) from ${users} r where r.manager_email = ${users.email})::int`,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        artifactsOwned: sql<number>`coalesce(${owned.ownedN}, 0)::int`,
        viewsMade: sql<number>`coalesce(${viewed.viewedN}, 0)::int`,
        lastViewAt: viewed.last,
      })
      .from(users)
      .leftJoin(manager, eq(manager.email, users.managerEmail))
      .leftJoin(owned, eq(owned.ownerId, users.id))
      .leftJoin(viewed, eq(viewed.userId, users.id))
      .where(where)
      .orderBy(sql`${users.lastLoginAt} desc nulls last`, asc(sql`lower(coalesce(${users.name}, ${users.email}))`))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(users).leftJoin(manager, eq(manager.email, users.managerEmail)).where(where),
  ]);
  return { rows, total, page };
}

/** Everyone, briefly, for pickers. */
export async function allPeopleBrief(): Promise<{ email: string; name: string | null }[]> {
  return db
    .select({ email: users.email, name: users.name })
    .from(users)
    .orderBy(asc(sql`lower(coalesce(${users.name}, ${users.email}))`));
}

export type SetManagerResult = { ok: true; managerName: string | null } | { ok: false; error: string };

/** Point a person at a manager (by email) or clear it. */
export async function setManager(userId: string, managerEmailRaw: string | null): Promise<SetManagerResult> {
  const [person] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!person) return { ok: false, error: "Person not found." };

  const managerEmail = managerEmailRaw ? normalizeEmail(managerEmailRaw) : null;
  if (managerEmail) {
    if (!isAllowedEmail(managerEmail)) return { ok: false, error: "Manager must have a company email." };
    if (managerEmail === person.email) return { ok: false, error: "Someone can't manage themselves." };
    // Guard against loops (A manages B manages A).
    let cursor: string | null = managerEmail;
    for (let i = 0; i < 20 && cursor; i++) {
      const [m]: { managerEmail: string | null }[] = await db
        .select({ managerEmail: users.managerEmail })
        .from(users)
        .where(eq(users.email, cursor))
        .limit(1);
      if (!m) break;
      if (m.managerEmail === person.email) return { ok: false, error: "That would create a reporting loop." };
      cursor = m.managerEmail;
    }
  }
  await db.update(users).set({ managerEmail }).where(eq(users.id, userId));
  const [m] = managerEmail
    ? await db.select({ name: users.name }).from(users).where(eq(users.email, managerEmail)).limit(1)
    : [{ name: null }];
  return { ok: true, managerName: m?.name ?? null };
}

export type SetAdminResult = { ok: true } | { ok: false; error: string };

/** Grant or remove admin access. Admins named in ADMIN_EMAILS can't be changed here. */
export async function setAdmin(actorId: string, userId: string, makeAdmin: boolean): Promise<SetAdminResult> {
  const [person] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!person) return { ok: false, error: "Person not found." };
  if (makeAdmin) {
    if (!isAllowedEmail(person.email)) return { ok: false, error: "Admins must have a company email." };
  } else {
    if (ADMIN_EMAILS.has(person.email)) return { ok: false, error: "This admin is set in the app's configuration (ADMIN_EMAILS)." };
    if (userId === actorId) return { ok: false, error: "You can't remove your own admin access. Ask another admin." };
  }
  await db.update(users).set({ isAdmin: makeAdmin }).where(eq(users.id, userId));
  return { ok: true };
}

export type AdminListRow = {
  /** Null for someone named in ADMIN_EMAILS who has never signed in or been imported. */
  id: string | null;
  email: string;
  name: string | null;
  image: string | null;
  title: string | null;
  department: string | null;
  lastLoginAt: Date | null;
  /** `config`: named in ADMIN_EMAILS, fixed. `promoted`: made an admin from Admin → People. */
  source: "config" | "promoted";
};

/** Everyone with admin access: the configured admins first, then promoted ones, each by name. */
export async function adminList(): Promise<AdminListRow[]> {
  const configured = [...ADMIN_EMAILS];
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      title: users.title,
      department: users.department,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(configured.length ? or(eq(users.isAdmin, true), inArray(users.email, configured)) : eq(users.isAdmin, true));

  const known = new Set(rows.map((r) => r.email));
  const list: AdminListRow[] = [
    ...rows.map((r) => ({ ...r, source: ADMIN_EMAILS.has(r.email) ? ("config" as const) : ("promoted" as const) })),
    ...configured
      .filter((email) => !known.has(email))
      .map((email) => ({ id: null, email, name: null, image: null, title: null, department: null, lastLoginAt: null, source: "config" as const })),
  ];
  const label = (r: AdminListRow) => (r.name ?? r.email).toLowerCase();
  return list.sort((a, b) => (a.source === b.source ? label(a).localeCompare(label(b)) : a.source === "config" ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Activity (paginated)
// ---------------------------------------------------------------------------

export type AdminViewRow = {
  id: number;
  viewedAt: Date;
  artifactId: string;
  slug: string;
  title: string;
  visibility: "private" | "domain" | "restricted";
  trashedAt: Date | null;
  viewerName: string | null;
  viewerEmail: string;
  viewerImage: string | null;
};

export type ActivityPageQuery = { q?: string; page?: number; days?: number };

export async function adminActivityPage(query: ActivityPageQuery): Promise<{ rows: AdminViewRow[]; total: number; page: number }> {
  const { limit, offset, page } = pageWindow(query.page ?? 1);
  const conditions: (SQL | undefined)[] = [];
  if (query.days) conditions.push(gte(artifactViews.viewedAt, new Date(Date.now() - query.days * DAY)));
  if (query.q?.trim()) {
    const pat = likePattern(query.q);
    conditions.push(or(ilike(users.name, pat), ilike(users.email, pat), ilike(artifacts.title, pat), ilike(artifacts.slug, pat)));
  }
  const where = and(...conditions.filter((c): c is SQL => Boolean(c)));

  const base = () =>
    db
      .select({
        id: artifactViews.id,
        viewedAt: artifactViews.viewedAt,
        artifactId: artifacts.id,
        slug: artifacts.slug,
        title: artifacts.title,
        visibility: artifacts.visibility,
        trashedAt: artifacts.trashedAt,
        viewerName: users.name,
        viewerEmail: users.email,
        viewerImage: users.image,
      })
      .from(artifactViews)
      .innerJoin(artifacts, eq(artifacts.id, artifactViews.artifactId))
      .innerJoin(users, eq(users.id, artifactViews.userId));

  const [rows, [{ total }]] = await Promise.all([
    base().where(where).orderBy(desc(artifactViews.viewedAt)).limit(limit).offset(offset),
    db
      .select({ total: count() })
      .from(artifactViews)
      .innerJoin(artifacts, eq(artifacts.id, artifactViews.artifactId))
      .innerJoin(users, eq(users.id, artifactViews.userId))
      .where(where),
  ]);
  return { rows, total, page };
}

export async function adminRecentViews(limit = 15): Promise<AdminViewRow[]> {
  const { rows } = await adminActivityPage({ page: 1 });
  return rows.slice(0, limit);
}


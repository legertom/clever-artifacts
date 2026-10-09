import { count, countDistinct, desc, eq, gte, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifactShares, artifactViews, artifacts, users } from "@/db/schema";

const DAY = 24 * 60 * 60 * 1000;

export async function adminOverview() {
  const since7d = new Date(Date.now() - 7 * DAY);
  const since30d = new Date(Date.now() - 30 * DAY);

  const [[artifactCounts], [userCount], [viewTotals], [views7d], [views30d], [activeUsers7d]] =
    await Promise.all([
      db
        .select({
          active: count(sql`case when ${artifacts.trashedAt} is null then 1 end`),
          trashed: count(sql`case when ${artifacts.trashedAt} is not null then 1 end`),
          bytes: sql<number>`coalesce(sum(${artifacts.htmlBytes}), 0)::int`,
        })
        .from(artifacts),
      db.select({ n: count() }).from(users),
      db
        .select({ views: count(), viewers: countDistinct(artifactViews.userId) })
        .from(artifactViews),
      db.select({ n: count() }).from(artifactViews).where(gte(artifactViews.viewedAt, since7d)),
      db.select({ n: count() }).from(artifactViews).where(gte(artifactViews.viewedAt, since30d)),
      db
        .select({ n: countDistinct(artifactViews.userId) })
        .from(artifactViews)
        .where(gte(artifactViews.viewedAt, since7d)),
    ]);

  return {
    artifactsActive: artifactCounts.active,
    artifactsTrashed: artifactCounts.trashed,
    totalBytes: artifactCounts.bytes,
    users: userCount.n,
    views: viewTotals.views,
    uniqueViewers: viewTotals.viewers,
    views7d: views7d.n,
    views30d: views30d.n,
    activeUsers7d: activeUsers7d.n,
  };
}

export type AdminArtifactRow = {
  id: string;
  slug: string;
  title: string;
  visibility: "domain" | "restricted";
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

export async function adminListArtifacts(): Promise<AdminArtifactRow[]> {
  const since7d = new Date(Date.now() - 7 * DAY);

  const shareCounts = db
    .select({ artifactId: artifactShares.artifactId, n: count().as("n") })
    .from(artifactShares)
    .groupBy(artifactShares.artifactId)
    .as("share_counts");

  const viewStats = db
    .select({
      artifactId: artifactViews.artifactId,
      viewers: countDistinct(artifactViews.userId).as("viewers"),
      recent: count(sql`case when ${artifactViews.viewedAt} >= ${since7d} then 1 end`).as("recent"),
    })
    .from(artifactViews)
    .groupBy(artifactViews.artifactId)
    .as("view_stats");

  return db
    .select({
      id: artifacts.id,
      slug: artifacts.slug,
      title: artifacts.title,
      visibility: artifacts.visibility,
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
      shareCount: sql<number>`coalesce(${shareCounts.n}, 0)::int`,
      uniqueViewers: sql<number>`coalesce(${viewStats.viewers}, 0)::int`,
      views7d: sql<number>`coalesce(${viewStats.recent}, 0)::int`,
    })
    .from(artifacts)
    .innerJoin(users, eq(users.id, artifacts.ownerId))
    .leftJoin(shareCounts, eq(shareCounts.artifactId, artifacts.id))
    .leftJoin(viewStats, eq(viewStats.artifactId, artifacts.id))
    .orderBy(desc(artifacts.viewCount), desc(artifacts.updatedAt));
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  lastLoginAt: Date;
  artifactsOwned: number;
  viewsMade: number;
  lastViewAt: Date | null;
};

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const owned = db
    .select({ ownerId: artifacts.ownerId, n: count().as("n") })
    .from(artifacts)
    .where(isNull(artifacts.trashedAt))
    .groupBy(artifacts.ownerId)
    .as("owned");
  const viewed = db
    .select({
      userId: artifactViews.userId,
      n: count().as("n"),
      last: max(artifactViews.viewedAt).as("last"),
    })
    .from(artifactViews)
    .groupBy(artifactViews.userId)
    .as("viewed");

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      artifactsOwned: sql<number>`coalesce(${owned.n}, 0)::int`,
      viewsMade: sql<number>`coalesce(${viewed.n}, 0)::int`,
      lastViewAt: viewed.last,
    })
    .from(users)
    .leftJoin(owned, eq(owned.ownerId, users.id))
    .leftJoin(viewed, eq(viewed.userId, users.id))
    .orderBy(desc(users.lastLoginAt));
}

export type AdminViewRow = {
  viewedAt: Date;
  artifactId: string;
  slug: string;
  title: string;
  trashedAt: Date | null;
  viewerName: string | null;
  viewerEmail: string;
  viewerImage: string | null;
};

export async function adminRecentViews(limit = 50): Promise<AdminViewRow[]> {
  return db
    .select({
      viewedAt: artifactViews.viewedAt,
      artifactId: artifacts.id,
      slug: artifacts.slug,
      title: artifacts.title,
      trashedAt: artifacts.trashedAt,
      viewerName: users.name,
      viewerEmail: users.email,
      viewerImage: users.image,
    })
    .from(artifactViews)
    .innerJoin(artifacts, eq(artifacts.id, artifactViews.artifactId))
    .innerJoin(users, eq(users.id, artifactViews.userId))
    .orderBy(desc(artifactViews.viewedAt))
    .limit(limit);
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

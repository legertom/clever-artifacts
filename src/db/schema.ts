import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  /** From the employee directory import; shown in share suggestions. */
  title: text("title"),
  department: text("department"),
  /** Lower-cased email of this person's manager, from the directory import. */
  managerEmail: text("manager_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Null for people imported from the directory who haven't signed in yet. */
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/**
 * private    → only the owner can view (the default).
 * domain     → anyone signed in with an allowed-domain account can view.
 * restricted → only the owner and the emails in artifact_shares can view.
 */
export const artifactVisibility = pgEnum("artifact_visibility", [
  "private",
  "domain",
  "restricted",
]);

export const screenshotStatus = pgEnum("screenshot_status", [
  "pending",
  "ready",
  "failed",
]);

export const artifacts = pgTable(
  "artifacts",
  {
    id: varchar("id", { length: 21 }).primaryKey(),
    /** URL handle, unique. Old handles live on in artifact_aliases. */
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Link back to where it came from (e.g. the Claude conversation). */
    sourceUrl: text("source_url"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    visibility: artifactVisibility("visibility").notNull().default("private"),
    /** With visibility=restricted: everyone whose manager is the owner may view. */
    shareWithReports: boolean("share_with_reports").notNull().default(false),
    html: text("html").notNull(),
    htmlBytes: integer("html_bytes").notNull(),
    /** JPEG, base64-encoded. Null until generated. */
    screenshot: text("screenshot"),
    screenshotStatus: screenshotStatus("screenshot_status")
      .notNull()
      .default("pending"),
    screenshotError: text("screenshot_error"),
    /** Denormalised counters; artifact_views has the detail. */
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    /** Set when moved to the trash; purged after TRASH_RETENTION_DAYS. */
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    trashedBy: uuid("trashed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("artifacts_owner_idx").on(t.ownerId),
    index("artifacts_updated_idx").on(t.updatedAt),
    index("artifacts_trashed_idx").on(t.trashedAt),
  ],
);

/** Previous slugs, so links keep working after a rename. */
export const artifactAliases = pgTable(
  "artifact_aliases",
  {
    slug: varchar("slug", { length: 80 }).primaryKey(),
    artifactId: varchar("artifact_id", { length: 21 })
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("artifact_aliases_artifact_idx").on(t.artifactId)],
);

export const artifactShares = pgTable(
  "artifact_shares",
  {
    artifactId: varchar("artifact_id", { length: 21 })
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    /** Lower-cased. Sharing is by email so people who haven't signed in yet can be added. */
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.artifactId, t.email] }),
    index("artifact_shares_email_idx").on(t.email),
  ],
);

/** Someone starred an artifact they can open; shown under "Favorites" on their dashboard. */
export const artifactFavorites = pgTable(
  "artifact_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artifactId: varchar("artifact_id", { length: 21 })
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.artifactId] }),
    index("artifact_favorites_artifact_idx").on(t.artifactId),
  ],
);

/** One row per time someone loads an artifact. */
export const artifactViews = pgTable(
  "artifact_views",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    artifactId: varchar("artifact_id", { length: 21 })
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("artifact_views_artifact_idx").on(t.artifactId, t.viewedAt),
    index("artifact_views_user_idx").on(t.userId, t.viewedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type ArtifactVisibility = Artifact["visibility"];

// ---------------------------------------------------------------------------
// OAuth 2.1 authorization server for the MCP endpoint
// ---------------------------------------------------------------------------

/** Registered MCP clients: dynamically registered (id "cl_…") or CIMD (id is an https URL). */
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** sha256 hex; null for public clients (PKCE only). */
  secretHash: text("secret_hash"),
  redirectUris: text("redirect_uris").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Short-lived authorization codes (single use). */
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthTokenKind = pgEnum("oauth_token_kind", ["access", "refresh", "pat"]);

/** Access tokens, refresh tokens and personal access tokens, stored hashed. */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    kind: oauthTokenKind("kind").notNull(),
    /** Null for personal tokens. */
    clientId: text("client_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("artifacts"),
    /** Label chosen by the user for personal tokens. */
    name: text("name"),
    /** Access tokens issued with a refresh token share its family id, for revoking a grant as a whole. */
    familyId: text("family_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oauth_tokens_user_idx").on(t.userId), index("oauth_tokens_family_idx").on(t.familyId)],
);

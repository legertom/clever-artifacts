import { sql } from "drizzle-orm";
import {
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * domain     → anyone signed in with an allowed-domain account can view.
 * restricted → only the owner and the emails in artifact_shares can view.
 */
export const artifactVisibility = pgEnum("artifact_visibility", [
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
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    visibility: artifactVisibility("visibility").notNull().default("domain"),
    html: text("html").notNull(),
    htmlBytes: integer("html_bytes").notNull(),
    /** JPEG, base64-encoded. Null until generated. */
    screenshot: text("screenshot"),
    screenshotStatus: screenshotStatus("screenshot_status")
      .notNull()
      .default("pending"),
    screenshotError: text("screenshot_error"),
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
  ],
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

export type User = typeof users.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type ArtifactVisibility = Artifact["visibility"];

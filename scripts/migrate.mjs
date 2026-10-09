// Applies the SQL migrations in ./drizzle to DATABASE_URL. Runs before
// `next build` so every Vercel deploy brings the schema up to date. Skips
// quietly when no DATABASE_URL is configured (e.g. a local build without a DB).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set; skipping migrations.");
  process.exit(0);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] schema is up to date.");

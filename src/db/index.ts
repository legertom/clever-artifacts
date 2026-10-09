import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return drizzle(neon(url), { schema });
}

export type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

/**
 * Lazily-connected Drizzle client. Deferring the connection to first use keeps
 * `next build` (which imports every route module) from needing a database.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

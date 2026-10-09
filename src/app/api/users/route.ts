import { and, ilike, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

/** People who have signed in before, for share-list autocomplete. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const rows = await db
    .select({ email: users.email, name: users.name, image: users.image })
    .from(users)
    .where(
      and(
        ne(users.id, user.id),
        q ? or(ilike(users.email, pattern), ilike(users.name, pattern)) : undefined,
      ),
    )
    .orderBy(users.email)
    .limit(8);

  return NextResponse.json({ users: rows });
}

import { and, ilike, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

/** People who have signed in before, for share-list autocomplete. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const includeSelf = url.searchParams.get("all") === "1";
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const rows = await db
    .select({ email: users.email, name: users.name, image: users.image, title: users.title, department: users.department })
    .from(users)
    .where(
      and(
        includeSelf ? undefined : ne(users.id, user.id),
        q ? or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.title, pattern), ilike(users.department, pattern)) : undefined,
      ),
    )
    .orderBy(
      q ? sql`case when ${users.name} ilike ${q + "%"} or ${users.email} ilike ${q + "%"} then 0 else 1 end` : sql`0`,
      sql`${users.lastLoginAt} desc nulls last`,
      users.name,
      users.email,
    )
    .limit(8);

  return NextResponse.json({ users: rows });
}

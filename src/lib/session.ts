import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAdminEmail } from "@/lib/config";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
};

/**
 * Admins are the emails in ADMIN_EMAILS plus anyone promoted from Admin → People.
 * Promotions are read from the database on each request (not baked into the
 * session token) so granting and removing access takes effect immediately.
 */
const isPromotedAdmin = cache(async (userId: string): Promise<boolean> => {
  const [row] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.isAdmin ?? false;
});

/** Current user, or null when there is no (complete) session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.email) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    image: u.image ?? null,
    isAdmin: isAdminEmail(u.email) || (await isPromotedAdmin(u.id)),
  };
}

/** For pages: redirect to login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For admin pages: 404 for everyone else so the page's existence isn't advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

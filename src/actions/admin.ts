"use server";

import { revalidatePath } from "next/cache";
import { setAdmin, setManager, type SetAdminResult, type SetManagerResult } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";

export async function setManagerAction(userId: string, managerEmail: string | null): Promise<SetManagerResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Admins only." };
  const res = await setManager(userId, managerEmail);
  if (res.ok) revalidatePath("/admin/people");
  return res;
}

/** Promote someone to admin, or take it back. */
export async function setAdminAction(userId: string, makeAdmin: boolean): Promise<SetAdminResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Admins only." };
  const res = await setAdmin(user.id, userId, makeAdmin === true);
  // People and Admins both show who is an admin.
  if (res.ok) revalidatePath("/admin", "layout");
  return res;
}

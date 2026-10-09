"use server";

import { revalidatePath } from "next/cache";
import { setManager, type SetManagerResult } from "@/lib/admin";
import { getSessionUser } from "@/lib/session";

export async function setManagerAction(userId: string, managerEmail: string | null): Promise<SetManagerResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Admins only." };
  const res = await setManager(userId, managerEmail);
  if (res.ok) revalidatePath("/admin/people");
  return res;
}

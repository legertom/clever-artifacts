"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { getOwnedArtifact, parseShareEmails, setShares } from "@/lib/artifacts";
import { getSessionUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateArtifact(
  id: string,
  input: { title: string; visibility: "domain" | "restricted"; shares: string[] },
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };

  const owned = await getOwnedArtifact(id, user);
  if (!owned) return { ok: false, error: "Artifact not found." };

  const title = input.title.trim().slice(0, 200);
  if (!title) return { ok: false, error: "Give the artifact a name." };

  const visibility = input.visibility === "restricted" ? "restricted" : "domain";
  const { emails, rejected } = parseShareEmails(input.shares, user.email);
  if (rejected.length) {
    return { ok: false, error: `These addresses can't be shared with: ${rejected.join(", ")}` };
  }

  await db
    .update(artifacts)
    .set({ title, visibility, updatedAt: new Date() })
    .where(eq(artifacts.id, id));
  await setShares(id, emails);

  revalidatePath("/");
  revalidatePath(`/a/${id}`);
  revalidatePath(`/a/${id}/settings`);
  return { ok: true };
}

export async function deleteArtifact(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };

  const owned = await getOwnedArtifact(id, user);
  if (!owned) return { ok: false, error: "Artifact not found." };

  await db.delete(artifacts).where(eq(artifacts.id, id));
  revalidatePath("/");
  redirect("/");
}

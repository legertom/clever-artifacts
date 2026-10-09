"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteForever,
  moveToTrash,
  restoreFromTrash,
  ServiceError,
  setFavorite,
  updateArtifact as updateArtifactService,
  type UpdateInput,
} from "@/lib/artifact-service";
import { getSessionUser } from "@/lib/session";

export type ActionResult = { ok: true; slug?: string } | { ok: false; error: string };

function errorResult(err: unknown): ActionResult {
  if (err instanceof ServiceError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Try again." };
}

function revalidateArtifact(slug: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/a/${slug}`);
  revalidatePath(`/a/${slug}/settings`);
}

export async function updateArtifact(id: string, input: UpdateInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  try {
    const r = await updateArtifactService(user, id, input);
    revalidateArtifact(r.slug);
    return { ok: true, slug: r.slug };
  } catch (e) {
    return errorResult(e);
  }
}

export async function trashArtifactAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  try {
    const r = await moveToTrash(user, id);
    revalidateArtifact(r.slug);
    return { ok: true, slug: r.slug };
  } catch (e) {
    return errorResult(e);
  }
}

export async function setFavoriteAction(id: string, favorited: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  try {
    const r = await setFavorite(user, id, favorited);
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/a/${r.slug}`);
    return { ok: true, slug: r.slug };
  } catch (e) {
    return errorResult(e);
  }
}

export async function restoreArtifactAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  try {
    const r = await restoreFromTrash(user, id);
    revalidateArtifact(r.slug);
    return { ok: true, slug: r.slug };
  } catch (e) {
    return errorResult(e);
  }
}

export async function deleteArtifactForeverAction(id: string, redirectTo?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  try {
    await deleteForever(user, id);
  } catch (e) {
    return errorResult(e);
  }
  revalidatePath("/");
  revalidatePath("/admin");
  if (redirectTo) redirect(redirectTo);
  return { ok: true };
}

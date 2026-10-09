"use server";

import { revalidatePath } from "next/cache";
import { createPersonalToken, revokeConnectedApp, revokePersonalToken } from "@/lib/oauth";
import { getSessionUser } from "@/lib/session";

export async function createTokenAction(name: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You're signed out. Reload and try again." };
  const token = await createPersonalToken(user.id, name);
  revalidatePath("/settings/mcp");
  return { ok: true, token };
}

export async function revokeTokenAction(tokenHash: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await revokePersonalToken(user.id, tokenHash);
  revalidatePath("/settings/mcp");
}

export async function disconnectAppAction(clientId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await revokeConnectedApp(user.id, clientId);
  revalidatePath("/settings/mcp");
}

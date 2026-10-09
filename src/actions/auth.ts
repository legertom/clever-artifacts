"use server";

import { signIn, signOut } from "@/auth";

function safeCallbackUrl(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  // Only allow same-origin paths.
  return v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

"use server";

import { redirect } from "next/navigation";
import { getClient, issueCode, OAUTH_SCOPE } from "@/lib/oauth";
import { getSessionUser } from "@/lib/session";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** Consent screen "Allow" / "Deny". */
export async function decideAuthorization(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clientId = str(formData, "client_id");
  const redirectUri = str(formData, "redirect_uri");
  const state = str(formData, "state");
  const codeChallenge = str(formData, "code_challenge");
  const decision = str(formData, "decision");

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    redirect("/oauth/authorize?error=invalid_client");
  }

  const target = new URL(redirectUri);
  if (state) target.searchParams.set("state", state);

  if (decision !== "allow") {
    target.searchParams.set("error", "access_denied");
    redirect(target.toString());
  }

  const code = await issueCode({
    clientId: client.id,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope: OAUTH_SCOPE,
  });
  target.searchParams.set("code", code);
  redirect(target.toString());
}

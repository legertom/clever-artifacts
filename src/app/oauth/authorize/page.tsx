import type { Metadata } from "next";
import { decideAuthorization } from "@/actions/oauth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { getClient, OAUTH_SCOPE } from "@/lib/oauth";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Authorize" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * OAuth 2.1 authorization endpoint. The proxy already made sure the person is
 * signed in with a Clever account; this page just asks for consent.
 */
export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const clientId = one(sp.client_id);
  const redirectUri = one(sp.redirect_uri);
  const state = one(sp.state);
  const codeChallenge = one(sp.code_challenge);
  const method = one(sp.code_challenge_method) || "S256";
  const responseType = one(sp.response_type) || "code";
  const scope = one(sp.scope) || OAUTH_SCOPE;

  let problem: string | null = null;
  const client = clientId ? await getClient(clientId) : null;
  if (one(sp.error) === "invalid_client") problem = "That client or redirect address isn't registered.";
  else if (!client) problem = "Unknown client. The app that sent you here may need to register first.";
  else if (!client.redirectUris.includes(redirectUri)) problem = "The redirect address doesn't match the client's registration.";
  else if (responseType !== "code") problem = "Only the authorization code flow is supported.";
  else if (!codeChallenge || method !== "S256") problem = "PKCE with S256 is required.";
  else if (scope.split(" ").some((s) => s !== OAUTH_SCOPE)) problem = `Unknown scope. Only “${OAUTH_SCOPE}” is available.`;

  let redirectHost = "";
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {}

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-8">
        <Logo />
        {problem ? (
          <>
            <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">Can&apos;t continue</h1>
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {problem}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
              Allow <span className="text-brand-700">{client!.name}</span> to use Clever Artifacts as you?
            </h1>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <Avatar name={user.name} email={user.email} image={user.image} size={32} />
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-neutral-900">{user.name ?? user.email}</div>
                <div className="truncate text-neutral-500">{user.email}</div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-neutral-700">
              <li className="flex gap-2"><Check /> See artifacts you own (including private ones) and ones shared with you</li>
              <li className="flex gap-2"><Check /> Upload, rename, share, trash and restore your artifacts</li>
              <li className="flex gap-2"><Check /> Look up people at Clever to share with</li>
              {user.isAdmin ? <li className="flex gap-2"><Check /> Read admin statistics (you&apos;re an admin)</li> : null}
            </ul>
            <p className="mt-4 text-xs text-neutral-500">
              It will send you back to <span className="font-mono">{redirectHost}</span>. You can disconnect it later
              from <span className="font-medium">Connect via MCP</span>.
            </p>
            <form action={decideAuthorization} className="mt-6 flex gap-3">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="state" value={state} />
              <input type="hidden" name="code_challenge" value={codeChallenge} />
              <button type="submit" name="decision" value="allow" className="btn-primary flex-1">
                Allow
              </button>
              <button type="submit" name="decision" value="deny" className="btn-secondary flex-1">
                Deny
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-emerald-600" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

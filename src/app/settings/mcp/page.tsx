import type { Metadata } from "next";
import { ConnectedApps, CopyField, PersonalTokens } from "@/components/mcp-access";
import { Nav } from "@/components/nav";
import { listConnectedApps, listPersonalTokens } from "@/lib/oauth";
import { getOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Connect via MCP" };

export default async function McpSettingsPage() {
  const user = await requireUser();
  const origin = await getOrigin();
  const mcpUrl = `${origin}/api/mcp`;
  const [tokens, apps] = await Promise.all([listPersonalTokens(user.id), listConnectedApps(user.id)]);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Connect via MCP</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Use Clever Artifacts from Claude, Claude Code, Cursor or any MCP client: list and search artifacts, upload new
          ones, change sharing, and manage the trash, all as you.
        </p>

        <section className="card mt-6 space-y-4 p-5">
          <CopyField label="MCP server URL" value={mcpUrl} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Claude (web, desktop)</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
                <li>Settings → Connectors → Add custom connector</li>
                <li>Paste the URL above; leave the OAuth fields empty</li>
                <li>Click Connect, sign in with Google, and press Allow</li>
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Claude Code</h3>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
                {`claude mcp add --transport http clever-artifacts \\\n  ${mcpUrl}`}
              </pre>
              <p className="mt-1 text-xs text-neutral-500">
                Run <span className="font-mono">/mcp</span> inside Claude Code to finish the sign-in. Or skip OAuth with a
                personal token: add <span className="font-mono">--header &quot;Authorization: Bearer …&quot;</span>.
              </p>
            </div>
          </div>
          <details className="text-sm text-neutral-600">
            <summary className="cursor-pointer font-medium text-neutral-800">What the tools can do</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {[
                ["list_artifacts", "yours, shared with you, or your trash"],
                ["get_artifact / get_artifact_html", "metadata or the full HTML"],
                ["create_artifact", "upload HTML (private by default), set sharing, get the link"],
                ["update_artifact", "rename, change the link, description, tags, sharing"],
                ["replace_artifact_html", "new version, same link"],
                ["trash_artifact / restore_artifact", "move to or out of the trash"],
                ["delete_artifact_permanently", "skip the 30-day wait"],
                ["list_people", "find teammates to share with"],
                ["admin_overview", "usage stats (admins only)"],
              ].map(([name, what]) => (
                <li key={name}>
                  <span className="font-mono text-xs text-neutral-800">{name}</span>
                  <span className="text-neutral-500"> — {what}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <div className="mt-6 space-y-6">
          <ConnectedApps apps={apps} />
          <PersonalTokens tokens={tokens} />
        </div>
      </main>
    </>
  );
}

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerArtifactTools } from "@/lib/mcp-tools";
import { appOrigin, OAUTH_SCOPE, verifyAccessToken } from "@/lib/oauth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * MCP endpoint (Streamable HTTP). Authentication is a bearer token issued by
 * this app's OAuth server (/oauth/*) or a personal token from /settings/mcp.
 */
function buildHandler(req: Request) {
  const origin = appOrigin(req);
  const mcp = createMcpHandler((server) => registerArtifactTools(server, origin), {
    serverInfo: { name: "clever-artifacts", version: "1.0.0" },
  });
  return withMcpAuth(
    mcp,
    async (_req, bearer) => {
      if (!bearer) return undefined;
      const v = await verifyAccessToken(bearer);
      if (!v) return undefined;
      return {
        token: bearer,
        clientId: v.clientId,
        scopes: v.scope.split(" "),
        expiresAt: v.expiresAt ? Math.floor(v.expiresAt.getTime() / 1000) : undefined,
        extra: { user: v.user },
      };
    },
    {
      required: true,
      requiredScopes: [OAUTH_SCOPE],
      // RFC 9728 path-based metadata URL: <origin>/.well-known/oauth-protected-resource/api/mcp
      resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
      resourceUrl: origin,
    },
  );
}

async function handle(req: Request) {
  return buildHandler(req)(req);
}

export { handle as GET, handle as POST, handle as DELETE };

import { registerClient } from "@/lib/oauth";
import { corsJson, oauthError, OPTIONS } from "@/lib/oauth-http";

export { OPTIONS };

/** RFC 7591 dynamic client registration (open, as the MCP spec expects). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return oauthError("invalid_client_metadata", "Expected a JSON body.");
  const res = await registerClient(body);
  if (!res.ok) return oauthError(res.error, res.description);
  const authMethod = res.secret ? (body.token_endpoint_auth_method === "client_secret_post" ? "client_secret_post" : "client_secret_basic") : "none";
  return corsJson(
    {
      client_id: res.client.id,
      ...(res.secret ? { client_secret: res.secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: res.client.name,
      redirect_uris: res.client.redirectUris,
      token_endpoint_auth_method: authMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "artifacts",
    },
    { status: 201 },
  );
}

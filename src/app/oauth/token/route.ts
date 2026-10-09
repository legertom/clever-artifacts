import { getClient, issueTokenPair, redeemCode, refreshTokens, verifyClientSecret } from "@/lib/oauth";
import { basicClientAuth, corsJson, oauthError, OPTIONS, readParams } from "@/lib/oauth-http";

export { OPTIONS };

export async function POST(req: Request) {
  const p = await readParams(req);
  const basic = basicClientAuth(req);
  const clientId = basic?.clientId ?? p.client_id;
  const clientSecret = basic?.clientSecret ?? p.client_secret ?? null;
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  const client = await getClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client.", 401);
  if (!verifyClientSecret(client, clientSecret)) return oauthError("invalid_client", "Bad client credentials.", 401);

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.redirect_uri) {
      return oauthError("invalid_request", "code, code_verifier and redirect_uri are required.");
    }
    const grant = await redeemCode({
      code: p.code,
      clientId: client.id,
      redirectUri: p.redirect_uri,
      codeVerifier: p.code_verifier,
    });
    if (!grant) return oauthError("invalid_grant", "The authorization code is invalid or expired.");
    const tokens = await issueTokenPair({ clientId: client.id, userId: grant.userId, scope: grant.scope });
    return corsJson(tokens);
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required.");
    const tokens = await refreshTokens(p.refresh_token, client.id);
    if (!tokens) return oauthError("invalid_grant", "The refresh token is invalid or expired.");
    return corsJson(tokens);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

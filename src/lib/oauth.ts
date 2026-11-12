import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthClients, oauthCodes, oauthTokens, users } from "@/db/schema";
import { isAdminEmail } from "@/lib/config";
import type { SessionUser } from "@/lib/session";

export const OAUTH_SCOPE = "artifacts";
const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function base64UrlSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/** The public origin of this deployment, for issuer / endpoint URLs. */
export function appOrigin(req: Request): string {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL;
  if (configured) return new URL(configured).origin;
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [OAUTH_SCOPE],
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/settings/mcp`,
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Clever Artifacts MCP",
    resource_documentation: `${origin}/settings/mcp`,
  };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export type OAuthClient = { id: string; name: string; redirectUris: string[]; secretHash: string | null };

function redirectUriAllowed(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

/** RFC 7591 dynamic registration. Returns the stored client plus the one-time secret (if confidential). */
export async function registerClient(body: Record<string, unknown>): Promise<
  { ok: true; client: OAuthClient; secret: string | null } | { ok: false; error: string; description: string }
> {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || !uris.every(redirectUriAllowed)) {
    return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris must be https (or http://localhost)." };
  }
  const name = (typeof body.client_name === "string" && body.client_name.trim().slice(0, 120)) || "MCP client";
  const authMethod = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "client_secret_basic";
  const secret = authMethod === "none" ? null : randomToken("cs");
  const id = `cl_${randomBytes(16).toString("base64url")}`;
  await db.insert(oauthClients).values({ id, name, redirectUris: uris, secretHash: secret ? sha256(secret) : null });
  return { ok: true, client: { id, name, redirectUris: uris, secretHash: secret ? sha256(secret) : null }, secret };
}

/**
 * Look up a client by id. For Client ID Metadata Documents (id is an https URL)
 * the document is fetched and cached in oauth_clients.
 */
export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
  if (row) {
    if (clientId.startsWith("https://")) {
      // Refresh CIMD data opportunistically; fall back to the cached copy.
      const fresh = await fetchClientMetadataDocument(clientId).catch(() => null);
      if (fresh) {
        await db
          .update(oauthClients)
          .set({ name: fresh.name, redirectUris: fresh.redirectUris })
          .where(eq(oauthClients.id, clientId));
        return fresh;
      }
    }
    return { id: row.id, name: row.name, redirectUris: row.redirectUris, secretHash: row.secretHash };
  }
  if (clientId.startsWith("https://")) {
    const fresh = await fetchClientMetadataDocument(clientId).catch(() => null);
    if (!fresh) return null;
    await db
      .insert(oauthClients)
      .values({ id: fresh.id, name: fresh.name, redirectUris: fresh.redirectUris, secretHash: null })
      .onConflictDoNothing();
    return fresh;
  }
  return null;
}

async function fetchClientMetadataDocument(url: string): Promise<OAuthClient | null> {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.hash) return null;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const doc = (await res.json()) as Record<string, unknown>;
  if (doc.client_id !== url) return null;
  const uris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((x): x is string => typeof x === "string") : [];
  if (!uris.length || !uris.every(redirectUriAllowed)) return null;
  const name = (typeof doc.client_name === "string" && doc.client_name.trim().slice(0, 120)) || u.hostname;
  return { id: url, name, redirectUris: uris, secretHash: null };
}

export function verifyClientSecret(client: OAuthClient, secret: string | null): boolean {
  if (!client.secretHash) return true; // public client
  if (!secret) return false;
  const a = Buffer.from(sha256(secret));
  const b = Buffer.from(client.secretHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

export async function issueCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): Promise<string> {
  const code = randomToken("ac");
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

/** Consume a code (single use). Returns null when invalid/expired/mismatched. */
export async function redeemCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ userId: string; scope: string } | null> {
  const [row] = await db
    .delete(oauthCodes)
    .where(eq(oauthCodes.codeHash, sha256(input.code)))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.clientId !== input.clientId) return null;
  if (row.redirectUri !== input.redirectUri) return null;
  if (base64UrlSha256(input.codeVerifier) !== row.codeChallenge) return null;
  return { userId: row.userId, scope: row.scope };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type IssuedTokens = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export async function issueTokenPair(input: {
  clientId: string;
  userId: string;
  scope: string;
  familyId?: string;
}): Promise<IssuedTokens> {
  const familyId = input.familyId ?? randomBytes(12).toString("base64url");
  const access = randomToken("cat");
  const refresh = randomToken("crt");
  const now = Date.now();
  await db.insert(oauthTokens).values([
    {
      tokenHash: sha256(access),
      kind: "access",
      clientId: input.clientId,
      userId: input.userId,
      scope: input.scope,
      familyId,
      expiresAt: new Date(now + ACCESS_TTL_MS),
    },
    {
      tokenHash: sha256(refresh),
      kind: "refresh",
      clientId: input.clientId,
      userId: input.userId,
      scope: input.scope,
      familyId,
      expiresAt: new Date(now + REFRESH_TTL_MS),
    },
  ]);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh,
    scope: input.scope,
  };
}

/** Rotate a refresh token. The old token (and its access tokens) are revoked. */
export async function refreshTokens(refreshToken: string, clientId: string): Promise<IssuedTokens | null> {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, sha256(refreshToken)), eq(oauthTokens.kind, "refresh")))
    .limit(1);
  if (!row || row.revokedAt || row.clientId !== clientId) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  if (row.familyId) {
    await db
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthTokens.familyId, row.familyId), isNull(oauthTokens.revokedAt)));
  }
  return issueTokenPair({ clientId, userId: row.userId, scope: row.scope, familyId: row.familyId ?? undefined });
}

export async function revokeToken(token: string): Promise<void> {
  const [row] = await db
    .select({ familyId: oauthTokens.familyId, tokenHash: oauthTokens.tokenHash })
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, sha256(token)))
    .limit(1);
  if (!row) return;
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      row.familyId
        ? and(eq(oauthTokens.familyId, row.familyId), isNull(oauthTokens.revokedAt))
        : eq(oauthTokens.tokenHash, row.tokenHash),
    );
}

export type VerifiedToken = {
  user: SessionUser;
  clientId: string;
  scope: string;
  expiresAt: Date | null;
  kind: "access" | "pat";
};

/** Resolve a bearer token to a user. Null when unknown, expired or revoked. */
export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
  if (!token || token.length > 256) return null;
  const hash = sha256(token);
  const [row] = await db
    .select({
      kind: oauthTokens.kind,
      clientId: oauthTokens.clientId,
      scope: oauthTokens.scope,
      expiresAt: oauthTokens.expiresAt,
      revokedAt: oauthTokens.revokedAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      isAdmin: users.isAdmin,
    })
    .from(oauthTokens)
    .innerJoin(users, eq(users.id, oauthTokens.userId))
    .where(
      and(
        eq(oauthTokens.tokenHash, hash),
        or(eq(oauthTokens.kind, "access"), eq(oauthTokens.kind, "pat")),
        isNull(oauthTokens.revokedAt),
        or(isNull(oauthTokens.expiresAt), gt(oauthTokens.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!row) return null;
  // Best-effort usage stamp; don't fail the request over it.
  db.update(oauthTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthTokens.tokenHash, hash))
    .catch(() => {});
  return {
    user: { id: row.userId, email: row.email, name: row.name, image: row.image, isAdmin: isAdminEmail(row.email) || row.isAdmin },
    clientId: row.clientId ?? "personal-token",
    scope: row.scope,
    expiresAt: row.expiresAt,
    kind: row.kind as "access" | "pat",
  };
}

// ---------------------------------------------------------------------------
// Personal access tokens + connected apps (for the /settings/mcp page)
// ---------------------------------------------------------------------------

export async function createPersonalToken(userId: string, name: string): Promise<string> {
  const token = randomToken("cpt");
  await db.insert(oauthTokens).values({
    tokenHash: sha256(token),
    kind: "pat",
    userId,
    scope: OAUTH_SCOPE,
    name: name.trim().slice(0, 80) || "Personal token",
    expiresAt: null,
  });
  return token;
}

export type PersonalTokenRow = { tokenHash: string; name: string | null; createdAt: Date; lastUsedAt: Date | null };

export async function listPersonalTokens(userId: string): Promise<PersonalTokenRow[]> {
  return db
    .select({
      tokenHash: oauthTokens.tokenHash,
      name: oauthTokens.name,
      createdAt: oauthTokens.createdAt,
      lastUsedAt: oauthTokens.lastUsedAt,
    })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.kind, "pat"), isNull(oauthTokens.revokedAt)))
    .orderBy(desc(oauthTokens.createdAt));
}

export async function revokePersonalToken(userId: string, tokenHash: string): Promise<void> {
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.tokenHash, tokenHash), eq(oauthTokens.userId, userId), eq(oauthTokens.kind, "pat")));
}

export type ConnectedAppRow = { clientId: string; clientName: string; grants: number; lastUsedAt: Date | null; since: Date };

/** OAuth clients holding live refresh tokens for this user. */
export async function listConnectedApps(userId: string): Promise<ConnectedAppRow[]> {
  return db
    .select({
      clientId: oauthTokens.clientId,
      clientName: sql<string>`coalesce(${oauthClients.name}, ${oauthTokens.clientId})`,
      grants: sql<number>`count(*)::int`,
      lastUsedAt: sql<Date | null>`max(${oauthTokens.lastUsedAt})`,
      since: sql<Date>`min(${oauthTokens.createdAt})`,
    })
    .from(oauthTokens)
    .leftJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(
      and(
        eq(oauthTokens.userId, userId),
        eq(oauthTokens.kind, "refresh"),
        isNull(oauthTokens.revokedAt),
        or(isNull(oauthTokens.expiresAt), gt(oauthTokens.expiresAt, new Date())),
      ),
    )
    .groupBy(oauthTokens.clientId, oauthClients.name)
    .orderBy(desc(sql`max(${oauthTokens.lastUsedAt})`)) as Promise<ConnectedAppRow[]>;
}

export async function revokeConnectedApp(userId: string, clientId: string): Promise<void> {
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.clientId, clientId), isNull(oauthTokens.revokedAt)));
}

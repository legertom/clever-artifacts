import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function corsJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...(init.headers ?? {}) },
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return corsJson({ error, error_description: description }, { status });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Parse a JSON or form-encoded body into a flat string map. */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(body)) if (typeof v === "string") out[k] = v;
    return out;
  }
  const text = await req.text().catch(() => "");
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

/** client_id / client_secret from HTTP Basic auth, if present. */
export function basicClientAuth(req: Request): { clientId: string; clientSecret: string } | null {
  const h = req.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("basic ")) return null;
  try {
    const [id, secret = ""] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
    return id ? { clientId: decodeURIComponent(id), clientSecret: decodeURIComponent(secret) } : null;
  } catch {
    return null;
  }
}

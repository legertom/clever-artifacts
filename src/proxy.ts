import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Optimistic auth gate: anything that isn't the login page or the Auth.js
 * endpoints requires a session cookie. Real authorization (who may see which
 * artifact) happens in the pages and route handlers themselves.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const signedIn = Boolean(req.auth?.user);

  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }

  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.nextUrl);
  login.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    // Everything except: Auth.js routes, the MCP endpoint and OAuth token/registration
    // endpoints (bearer / client auth), well-known metadata, cron, Next internals, static files.
    "/((?!api/auth|api/mcp|api/cron|oauth/token|oauth/register|oauth/revoke|\\.well-known|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};

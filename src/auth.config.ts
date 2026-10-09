import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/config";

/**
 * Database-free part of the Auth.js config. `proxy.ts` uses this alone so the
 * per-request session check never touches Postgres; `auth.ts` layers the
 * user-upsert on top.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      authorization: {
        params: {
          // Ask Google to show only accounts on our Workspace domain.
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email;
      if (!email || profile.email_verified !== true) return false;
      if (!isAllowedEmail(email)) return false;
      // Google sets `hd` for Workspace accounts; if present it must match too.
      const hd = (profile as { hd?: string }).hd;
      if (hd && hd.toLowerCase() !== ALLOWED_EMAIL_DOMAIN) return false;
      return true;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
} satisfies NextAuthConfig;

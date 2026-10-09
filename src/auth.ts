import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeEmail } from "@/lib/config";

async function upsertUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const [row] = await db
    .insert(users)
    .values({ email, name: input.name ?? null, image: input.image ?? null, lastLoginAt: new Date() })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: input.name ?? null,
        image: input.image ?? null,
        lastLoginAt: new Date(),
      },
    })
    .returning({ id: users.id });
  return row.id;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        // First sign-in for this session: record the user and remember our id.
        token.uid = await upsertUser({
          email: profile.email,
          name: profile.name,
          image: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.email = normalizeEmail(profile.email);
      } else if (!token.uid && token.email) {
        // Token minted before we tracked ids; backfill once.
        token.uid = await upsertUser({
          email: token.email,
          name: token.name,
          image: token.picture,
        });
      }
      return token;
    },
  },
});

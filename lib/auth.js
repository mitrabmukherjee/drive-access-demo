import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { authConfig } from "../auth.config";
import { isWorkspaceEmail } from "./drive";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      if (!isWorkspaceEmail(user?.email)) return "/login?error=Domain";
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (!token?.id) {
        return { ...session, user: null };
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          name: session.user?.name ?? token.name ?? null,
          email: session.user?.email ?? token.email ?? null,
          image: session.user?.image ?? token.picture ?? null,
        },
      };
    },
  },
});

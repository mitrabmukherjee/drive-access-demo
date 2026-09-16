import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js options (no Prisma).
 * Full adapter + callbacks live in lib/auth.js.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
          hd: "steorasystems.com",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      name: "drive-demo.session-token",
    },
  },
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return { ...session, user: session.user ?? null };
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: String(token.id),
          email: token.email ?? session.user?.email ?? null,
          name: token.name ?? session.user?.name ?? null,
          image: token.picture ?? token.image ?? session.user?.image ?? null,
        },
      };
    },
  },
};

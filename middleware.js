import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const email = req.auth?.user?.email;
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  if (!email && !isLogin) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (email && isLogin) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

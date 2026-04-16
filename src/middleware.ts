import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (token && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/onboarding") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/onboarding/submit") ||
          pathname.startsWith("/api/health")
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)" ],
};

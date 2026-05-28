import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isAppRoute = pathname.startsWith("/app");
  const isApiRoute = pathname.startsWith("/api/");
  const isLoggedIn = !!req.cookies.get(SESSION_COOKIE);

  // CORS for chrome-extension origin (applies to /api/*)
  if (isApiRoute) {
    const origin = req.headers.get("origin");
    if (origin?.startsWith("chrome-extension://")) {
      if (req.method === "OPTIONS") {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "content-type, authorization",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      const res = NextResponse.next();
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      return res;
    }
  }

  if (isAppRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.well-known).*)"],
};

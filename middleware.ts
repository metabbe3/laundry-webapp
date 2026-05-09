import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie-only auth check (performance optimization for Edge Runtime).
// This only checks for the presence of a session cookie — a forged cookie with any value passes here.
// Full JWT validation happens in API routes via the `auth()` function, so this is safe as a first gate.
// This avoids importing Prisma in the Edge Runtime, which is not supported.
export function middleware(req: NextRequest) {
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const isLoginRoute = req.nextUrl.pathname.startsWith("/login");
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isPublicRoute = req.nextUrl.pathname.startsWith("/track") || req.nextUrl.pathname.startsWith("/api/track");

  if (isApiAuthRoute || isPublicRoute) return NextResponse.next();

  if (!sessionToken && !isLoginRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (sessionToken && isLoginRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/profile", "/saved", "/notifications"];
const GUEST_ONLY_PREFIXES = ["/login", "/signup"];

/** Where a signed-in visitor belongs when they land somewhere they shouldn't be. */
function homeFor(role: string): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = matches(pathname, PROTECTED_PREFIXES);
  const isGuestOnly = matches(pathname, GUEST_ONLY_PREFIXES);
  if (!isProtected && !isGuestOnly) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in — the login and signup screens have nothing left to offer.
  if (isGuestOnly) {
    return session
      ? NextResponse.redirect(new URL(homeFor(session.role), request.url))
      : NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/saved/:path*",
    "/notifications/:path*",
    "/login/:path*",
    "/signup/:path*",
  ],
};

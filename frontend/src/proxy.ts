import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

/** Pages only a signed-in account may see. */
// /dashboard is the public overview now; the company workspace lives at /matches.
const PROTECTED_PREFIXES = [
  "/matches",
  "/admin",
  "/owner",
  "/auditor",
  "/profile",
  "/saved",
  "/notifications",
];
/**
 * Pages only an admin may see. /owner is here until there is an owner role to
 * give it to — its hide/restore actions are admin-only already, and it embeds
 * the ranked-companies panel, which is too.
 */
const ADMIN_ONLY_PREFIXES = ["/admin", "/owner"];
/** Pages only the Auditor Office may see. */
const AUDITOR_ONLY_PREFIXES = ["/auditor"];
/** The one protected page a public viewer has: their own saved list. */
const VIEWER_PREFIXES = ["/saved"];
/** Pages that make no sense once you are signed in. */
const GUEST_ONLY_PREFIXES = ["/login", "/signup"];

/**
 * Routes that must stay reachable without a session: signing in, signing out,
 * and asking who you are all have to work before one exists. Approval is
 * enforced at login by the backend, so a token in hand already means approved.
 */
const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/google",
  "/api/auth/google/complete",
];

/** Announcement files are as public as the announcement pages that show them. */
const PUBLIC_API_PATTERNS = [
  /^\/api\/tor\/[^/]+\/documents\/\d+(?:\/entries(?:\/\d+)?)?$/,
  /^\/api\/tor\/[^/]+\/egp-documents(?:\/[a-z-]+(?:\/entries(?:\/\d+)?)?)?$/,
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * One gate for pages and API routes. Pages redirect, because a person needs
 * somewhere to go; API routes answer 401, because a fetch needs a status it can
 * act on rather than the HTML of a login screen.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_ROUTES.includes(pathname) || PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) {
      return NextResponse.next();
    }

    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    return session
      ? NextResponse.next()
      : NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // The landing page is the first impression for guests; once signed in, the
  // logo and every link to "/" lead to the role's own home instead (#252).
  if (pathname === "/") {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next();
  }

  const isProtected = matches(pathname, PROTECTED_PREFIXES);
  const isGuestOnly = matches(pathname, GUEST_ONLY_PREFIXES);
  if (!isProtected && !isGuestOnly) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

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

  // Every other protected page is a company or staff workspace; a public viewer
  // has nothing there, so send them back to search instead of a half-empty shell.
  if (session.role === "viewer" && !matches(pathname, VIEWER_PREFIXES)) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  if (matches(pathname, ADMIN_ONLY_PREFIXES) && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (matches(pathname, AUDITOR_ONLY_PREFIXES) && session.role !== "auditor") {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/matches/:path*",
    "/admin/:path*",
    "/owner/:path*",
    "/auditor/:path*",
    "/profile/:path*",
    "/saved/:path*",
    "/notifications/:path*",
    "/login/:path*",
    "/signup/:path*",
  ],
};

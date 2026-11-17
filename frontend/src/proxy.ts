import { NextResponse, type NextRequest } from "next/server";

import {
  type SessionPayload,
  SESSION_COOKIE,
  refreshSessionToken,
  sessionCookieOptions,
  sessionNeedsRefresh,
  verifySessionToken,
} from "@/lib/auth";
import { jsonResponse } from "@/lib/json-response";
import { homeFor } from "@/lib/roles";

/** Pages only a signed-in account may see. */
// /dashboard is the public overview now; the company workspace lives at /matches.
const PROTECTED_PREFIXES = [
  "/matches",
  "/admin",
  "/owner",
  "/auditor",
  "/profile",
  "/library",
  "/saved",
  "/notifications",
];
/** Pages only an admin may see. */
const ADMIN_ONLY_PREFIXES = ["/admin"];
/** The project owner's own announcements; the data behind it is owner-only too. */
const OWNER_ONLY_PREFIXES = ["/owner"];
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
  // Called by LINE's servers, not a browser; the backend checks its signature.
  "/api/line/webhook",
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
 * ASVS 3.4.3: a strict policy for every page, with a fresh nonce per request.
 * Next.js puts the nonce on its own scripts and on every `next/script`, and
 * `'strict-dynamic'` lets those load what they need (the Google sign-in
 * script) — any other script, inline or injected, is refused. Inline style
 * attributes stay allowed: React and the Google button use them, and styles
 * can't run code.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com/gsi/client${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://accounts.google.com/gsi/${isDev ? " ws: wss:" : ""}`,
    "frame-src 'self' https://accounts.google.com/gsi/",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** The incoming headers as the page should see them: the refreshed session and the CSP nonce. */
function forwardedHeaders(request: NextRequest, refreshedToken: string | null, csp: string | null, nonce: string | null) {
  const headers = new Headers(request.headers);
  if (refreshedToken) {
    // Server components in this same request forward the cookie to the
    // backend, so they must already see the re-signed token.
    const cookies = request.cookies
      .getAll()
      .map(({ name, value }) => `${name}=${name === SESSION_COOKIE ? refreshedToken : value}`);
    headers.set("cookie", cookies.join("; "));
  }
  if (csp && nonce) {
    headers.set("Content-Security-Policy", csp);
    headers.set("x-nonce", nonce);
  }
  return headers;
}

/**
 * Runs for every page and API request. It reads the session once, keeps an
 * active session alive (ASVS 7.3.1: an idle one has already expired in
 * `verifySessionToken`), gates the request, and sets the CSP on pages.
 */
export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(rawToken);
  // GET only: logout and the change-password action clear the cookie on POST,
  // and a refresh in the same response must not set it back.
  const refreshedToken =
    session && request.method === "GET" && sessionNeedsRefresh(session) ? await refreshSessionToken(session) : null;
  const nonce = isApi ? null : btoa(crypto.randomUUID());
  const csp = nonce ? contentSecurityPolicy(nonce) : null;

  const response =
    gate(request, session) ??
    NextResponse.next({ request: { headers: forwardedHeaders(request, refreshedToken, csp, nonce) } });

  if (csp) response.headers.set("Content-Security-Policy", csp);
  if (session && refreshedToken) {
    const secondsLeft = session.exp - Math.floor(Date.now() / 1000);
    response.cookies.set(SESSION_COOKIE, refreshedToken, sessionCookieOptions(secondsLeft));
  } else if (rawToken && !session) {
    // Expired, idle or forged: drop it so the browser stops sending it.
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  }
  return response;
}

/**
 * One gate for pages and API routes; null lets the request through. Pages
 * redirect, because a person needs somewhere to go; API routes answer 401,
 * because a fetch needs a status it can act on rather than a login screen.
 */
function gate(request: NextRequest, session: SessionPayload | null): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_ROUTES.includes(pathname) || PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) {
      return null;
    }
    return session ? null : jsonResponse({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // The landing page is the first impression for guests; once signed in, the
  // logo and every link to "/" lead to the role's own home instead (#252).
  if (pathname === "/") {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : null;
  }

  const isProtected = matches(pathname, PROTECTED_PREFIXES);
  const isGuestOnly = matches(pathname, GUEST_ONLY_PREFIXES);
  if (!isProtected && !isGuestOnly) return null;

  if (isGuestOnly) {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : null;
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

  if (matches(pathname, OWNER_ONLY_PREFIXES) && session.role !== "owner") {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  if (matches(pathname, AUDITOR_ONLY_PREFIXES) && session.role !== "auditor") {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  return null;
}

export const config = {
  // Every page and API route (CSP and the idle timeout apply everywhere),
  // but not build assets, fonts or images.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$).*)"],
};

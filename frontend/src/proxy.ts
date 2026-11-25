import { NextResponse, type NextRequest } from "next/server";

import {
  type SessionPayload,
  SESSION_COOKIE,
  needsPasskeySetup,
  refreshSessionToken,
  sessionCookieOptions,
  sessionNeedsRefresh,
  verifySessionToken,
} from "@/lib/auth";
import { LOCALE_COOKIE } from "@/i18n/config";
import { jsonResponse } from "@/lib/json-response";
import { type Role, homeFor } from "@/lib/roles";
import { newCspNonce, pageContentSecurityPolicy } from "@/lib/csp";
import { isSessionOpen } from "@/lib/session-check";
import { httpsRedirectTarget } from "@/lib/https-redirect";
import { isCrossSiteWrite } from "@/lib/request-origin";
import { isUnexpectedFile } from "@/lib/served-files";

/** Pages only a signed-in account may see. */
// /dashboard is the public overview now; the company workspace lives at /matches.
const PROTECTED_PREFIXES = [
  "/matches",
  "/admin",
  "/profile",
  "/library",
  "/growth",
  "/saved",
  "/notifications",
  // The account's own sign-in settings: signed-in devices for everyone, and
  // change password for every account that has one.
  "/account",
];
/** Pages only an admin may see. */
const ADMIN_ONLY_PREFIXES = ["/admin"];
/** The company's own workspace; staff have their own consoles and a viewer has none. */
const ORG_ONLY_PREFIXES = ["/matches", "/profile", "/library", "/growth", "/notifications"];
/** The protected pages a public viewer has: their own saved list, and their signed-in devices on /account. */
const VIEWER_PREFIXES = ["/saved", "/account"];
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
  // Issues the Google sign-in nonce, before any session exists.
  "/api/auth/google/nonce",
  // Called by LINE's servers, not a browser; the backend checks its signature.
  "/api/line/webhook",
  // Step two of a staff sign-in: no session exists until the passkey answers.
  "/api/auth/passkey/login",
  // Browsers post CSP violation reports without the session cookie.
  "/api/csp-report",
];

/**
 * Accounts that work inside the company workspace (the sidebar with company
 * profile, matches, library…). /search, and /dashboard, /insights or a TOR
 * opened with `?in=app`, are that workspace's view of public pages; anyone else
 * gets the public view.
 */
const WORKSPACE_ROLES: readonly Role[] = ["org"];

/** Announcement files are as public as the announcement pages that show them. */
const PUBLIC_API_PATTERNS = [
  /^\/api\/tor\/[^/]+\/documents\/\d+(?:\/entries(?:\/\d+)?)?$/,
  /^\/api\/tor\/[^/]+\/egp-documents(?:\/[a-z-]+(?:\/entries(?:\/\d+)?)?)?$/,
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
 * Runs for every page and API request. It reads the session once, asks the
 * backend on page loads whether it is still open (`isSessionOpen`), keeps an
 * active session alive (ASVS 7.3.1: an idle one has already expired in
 * `verifySessionToken`), gates the request, and sets the CSP on pages.
 */
export async function proxy(request: NextRequest) {
  // Plain HTTP through a proxy goes to HTTPS before anything else (docs/SECURITY.md G9).
  const secure = httpsRedirectTarget(request.nextUrl, request.headers);
  if (secure) return NextResponse.redirect(secure, 308);

  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  let session = await verifySessionToken(rawToken);
  // A full page load with a validly signed cookie also asks the backend whether
  // the session is still open: one ended elsewhere is signed out here too, and
  // its cookie dropped below. Only full loads (`Sec-Fetch-Dest: document`, or a
  // client that sends no such header): Next.js prefetches every link on a page,
  // and those requests would multiply the check. In-app navigation and API
  // routes need none, because the backend refuses an ended session's data.
  const fetchDest = request.headers.get("sec-fetch-dest");
  const isPageLoad = !isApi && request.method === "GET" && (fetchDest === null || fetchDest === "document");
  if (session && rawToken && isPageLoad && !(await isSessionOpen(rawToken, request.headers.get("x-forwarded-for")))) {
    session = null;
  }
  // GET only: logout and the change-password action clear the cookie on POST,
  // and a refresh in the same response must not set it back.
  const refreshedToken =
    session && request.method === "GET" && sessionNeedsRefresh(session) ? await refreshSessionToken(session) : null;
  const nonce = isApi ? null : newCspNonce();
  const csp = nonce ? pageContentSecurityPolicy(nonce) : null;

  const response =
    gate(request, session) ??
    NextResponse.next({ request: { headers: forwardedHeaders(request, refreshedToken, csp, nonce) } });

  if (csp) response.headers.set("Content-Security-Policy", csp);
  if (session && refreshedToken) {
    const secondsLeft = session.exp - Math.floor(Date.now() / 1000);
    response.cookies.set(SESSION_COOKIE, refreshedToken, sessionCookieOptions(secondsLeft));
  } else if (rawToken && !session) {
    // Expired, idle, forged or ended: drop it so the browser stops sending it.
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

  // ASVS 13.4.7: no page looks like a file; see served-files.ts.
  if (isUnexpectedFile(pathname)) return new NextResponse("Not found", { status: 404 });

  if (pathname.startsWith("/api/")) {
    // A write another site started is refused before anything else (docs/SECURITY.md G5).
    if (isCrossSiteWrite(request.method, pathname, request.headers)) {
      return jsonResponse({ error: "Cross-site request refused." }, { status: 403 });
    }
    if (PUBLIC_API_ROUTES.includes(pathname) || PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) {
      return null;
    }
    // The proxy runs before next-intl's request config, so it reads the language cookie itself.
    const signIn = request.cookies.get(LOCALE_COOKIE)?.value === "en" ? "Please sign in." : "กรุณาเข้าสู่ระบบ";
    return session ? null : jsonResponse({ error: signIn }, { status: 401 });
  }

  // The landing page is the first impression for guests; once signed in, the
  // logo and every link to "/" lead to the role's own home instead (#252).
  if (pathname === "/") {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : null;
  }

  const toPublicView = publicViewFor(request, session);
  if (toPublicView) return NextResponse.redirect(toPublicView);

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

  // An account that must use a passkey but hasn't added one yet (staff, and
  // companies when required) can only reach /account to add it; the backend
  // refuses its data too (ASVS 6.3.3).
  if (needsPasskeySetup(session) && !matches(pathname, ["/account"])) {
    return NextResponse.redirect(new URL("/account?passkey=setup", request.url));
  }

  if (matches(pathname, ADMIN_ONLY_PREFIXES) && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (matches(pathname, ORG_ONLY_PREFIXES) && session.role !== "org") {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  return null;
}

/**
 * The public page a workspace URL stands for, when the session isn't a
 * workspace account (a viewer, staff, or a guest); null otherwise. Keeps the
 * rest of the query, so filters and `?similar=` survive the move.
 */
function publicViewFor(request: NextRequest, session: SessionPayload | null): URL | null {
  const { pathname, searchParams } = request.nextUrl;
  const inWorkspace = session ? WORKSPACE_ROLES.includes(session.role) : false;
  const url = request.nextUrl.clone();

  if (pathname === "/search" && !inWorkspace) {
    url.pathname = "/public";
    return url;
  }
  // The workspace's view of the overview, the insights or a TOR, for anyone without one.
  const workspaceView = pathname === "/dashboard" || pathname === "/insights" || /^\/tor\/[^/]+$/.test(pathname);
  if (workspaceView && searchParams.get("in") === "app" && !inWorkspace) {
    url.searchParams.delete("in");
    return url;
  }
  // The company's shared saved list; a viewer's own list is plain /saved.
  if (pathname === "/saved" && searchParams.get("scope") === "org" && session?.role !== "org") {
    url.searchParams.delete("scope");
    return url;
  }
  return null;
}

export const config = {
  // Every page and API route (CSP and the idle timeout apply everywhere),
  // but not build assets, fonts or images.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$).*)"],
};

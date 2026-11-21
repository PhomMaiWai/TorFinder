/**
 * docs/SECURITY.md G5: a browser request that changes something must come
 * from this site's own pages. The session cookie is SameSite=Lax, which
 * already keeps it off cross-site POSTs; this is the second check, so a
 * route handler never acts on a write another site started, whatever the
 * cookie attributes or browser.
 *
 * Browsers mark every request with `Sec-Fetch-Site`; older ones still send
 * `Origin` on a POST. A request with neither came from no browser (curl, a
 * server), carries no victim's cookie, and is left to the session check.
 */

/** Reads that change nothing need no check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Written to by other servers, never by a page here: LINE's webhook (signed) and CSP reports. */
export const ORIGIN_EXEMPT_ROUTES = ["/api/line/webhook", "/api/csp-report"];

type HeaderReader = { get(name: string): string | null };

/** The host this request was addressed to, as the browser saw it (a reverse proxy passes it on). */
function requestHost(headers: HeaderReader): string | null {
  return (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0].trim().toLowerCase() ?? null;
}

/** True when a write to `pathname` was started by another site and must be refused. */
export function isCrossSiteWrite(method: string, pathname: string, headers: HeaderReader): boolean {
  if (SAFE_METHODS.has(method.toUpperCase()) || ORIGIN_EXEMPT_ROUTES.includes(pathname)) return false;

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";

  const origin = headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true;
  try {
    return new URL(origin).host.toLowerCase() !== requestHost(headers);
  } catch {
    return true;
  }
}

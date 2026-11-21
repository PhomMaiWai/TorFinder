/**
 * docs/SECURITY.md G9: in production a page or API call that reached us over
 * plain HTTP through a proxy is sent to the same address over HTTPS, so no
 * session cookie or form is ever exchanged in the clear. The Caddy edge
 * (docker-compose.edge.yml) already upgrades HTTP itself; this covers any
 * other proxy put in front. The local stack (localhost) is left alone.
 */

type HeaderReader = { get(name: string): string | null };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The HTTPS address to send this request to, or null when it may go on as it is. */
export function httpsRedirectTarget(url: URL, headers: HeaderReader, isProduction = process.env.NODE_ENV === "production"): URL | null {
  if (!isProduction) return null;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  if (proto !== "http") return null;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? url.host).split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (!hostname || LOCAL_HOSTS.has(hostname)) return null;
  const target = new URL(url.pathname + url.search, `https://${hostname}`);
  return target;
}

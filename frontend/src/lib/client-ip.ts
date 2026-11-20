import { headers } from "next/headers";

/**
 * The browser's address, passed on to the backend so its rate limits count
 * each client separately (ASVS 6.3.1). Without it every throttled call arrives
 * from this server's own address, and five bad logins by anyone would lock
 * everyone out for a minute.
 *
 * Only the right-most `X-Forwarded-For` entry is sent: it was written by the
 * nearest hop, the reverse proxy in front of Next.js, which appends the
 * address it saw (ASVS 4.1.3, 15.3.4). Earlier entries are whatever the client
 * claimed. Next.js itself fills the header from the socket only when it is
 * missing (`??=` in next/dist/server/base-server.js), so a client that reached
 * Next.js directly could name any address. That is why docker-compose.yml
 * binds Next.js to 127.0.0.1: the proxy is the only way in, and the deployment
 * checklist requires it to append the address. The backend also limits
 * failed logins per account, so a wrong address can't skip that limit.
 *
 * Server-side only (route handlers and server actions).
 */
/** An IPv4 or IPv6 address as text: digits, hex letters, dots and colons, at most 45 characters. */
const IP_LIKE = /^[0-9a-fA-F.:]{2,45}$/;

export async function clientIpHeaders(): Promise<Record<string, string>> {
  return clientIpHeadersFrom((await headers()).get("x-forwarded-for"));
}

/** The same, from an `X-Forwarded-For` value already in hand (the proxy has the request itself). */
export function clientIpHeadersFrom(forwarded: string | null): Record<string, string> {
  const ip = forwarded?.split(",").pop()?.trim();
  // ASVS 4.2.5: only an address-shaped value is forwarded, so a client can't
  // make this server send the backend an oversized or malformed header.
  return ip && IP_LIKE.test(ip) ? { "X-Forwarded-For": ip } : {};
}

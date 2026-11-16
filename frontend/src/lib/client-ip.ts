import { headers } from "next/headers";

/**
 * The browser's address, passed on to the backend so its rate limits count
 * each client separately (ASVS 6.3.1). Without it every throttled call arrives
 * from this server's own address, and five bad logins by anyone would lock
 * everyone out for a minute.
 *
 * Only the right-most `X-Forwarded-For` entry is sent: it was written by the
 * nearest hop — Next.js itself from the socket when the browser connects
 * directly, or a trusted reverse proxy that appends the real address. Earlier
 * entries are whatever the client claimed. A client talking to Next.js
 * directly can still spoof this one value, which is why the backend also
 * limits failed logins per account rather than trusting the address alone.
 *
 * Server-side only (route handlers and server actions).
 */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",").pop()?.trim();
  return ip ? { "X-Forwarded-For": ip } : {};
}

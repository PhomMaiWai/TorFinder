import { clientIpHeadersFrom } from "@/lib/client-ip";

/**
 * Whether the backend still accepts this session (ASVS 7.4.1, 7.5.2). The
 * cookie's signature only proves the token was issued; a session can since
 * have been ended by logout elsewhere, another device, an admin or a password
 * change, and only the backend knows. The proxy asks before each page.
 *
 * Only a 401 means "ended". If the backend can't be reached, the page is let
 * through: every request for the account's data still goes to the backend,
 * which refuses an ended session, so an outage doesn't sign everyone out.
 */
export async function isSessionOpen(token: string, forwardedFor: string | null): Promise<boolean> {
  const backend = process.env.BACKEND_URL;
  if (!backend) return true;
  try {
    const res = await fetch(`${backend}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}`, ...clientIpHeadersFrom(forwardedFor) },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.status !== 401;
  } catch {
    return true;
  }
}

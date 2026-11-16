
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { jsonResponse } from "@/lib/json-response";
import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST() {
  const headers = await authHeaders();
  if ("Authorization" in headers) {
    // Revokes the token server-side (ASVS 7.4.1) so a copy of it can't be
    // replayed after this. Best-effort: the user is logging out either way,
    // and the cookie below is cleared regardless of whether this succeeds.
    await fetch(`${BACKEND_URL}/api/auth/logout`, { method: "POST", headers }).catch(() => null);
  }

  const response = jsonResponse({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}

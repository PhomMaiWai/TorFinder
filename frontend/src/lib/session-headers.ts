import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth";

/**
 * The caller's own session, forwarded to the backend. Server-side only: the
 * cookie is httpOnly, so a route handler or server action reads it here and the
 * backend's guards verify the token off this header.
 *
 * No session means no header rather than an error — the backend answers 401 or
 * 403 itself, and one place deciding that keeps every caller consistent.
 */
export async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

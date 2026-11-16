"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { authHeaders } from "@/lib/session-headers";

/** `error` is the backend's own message when it gave one; null means "show the generic failure". */
export type ChangePasswordResult = { ok: true } | { ok: false; error: string | null };

/**
 * Changes the signed-in user's password (ASVS 6.2.2 / 6.2.3). The backend ends
 * every session on success, so the now-dead cookie is cleared here too and the
 * page sends the user to sign in again.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/password`, {
      method: "POST",
      headers: { ...(await authHeaders()), ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: null };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { ok: false, error: typeof message === "string" ? message : null };
  }

  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return { ok: true };
}

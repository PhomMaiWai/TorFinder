"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { authHeaders } from "@/lib/session-headers";

/** One place this account is signed in (ASVS 7.5.2). */
export type SignedInSession = { id: string; device: string | null; ip: string | null; createdAt: string; current: boolean };
export type SessionList = { needsPassword: boolean; sessions: SignedInSession[] };

/** `error` is the backend's own message when it gave one; null means "show the generic failure". */
export type EndSessionsResult = { ok: true; signedOut: boolean } | { ok: false; error: string | null; reauth: boolean };

/** A session id is 16 random bytes, base64url: 22 characters. */
const SESSION_ID = /^[A-Za-z0-9_-]{22}$/;

/**
 * A session id as one segment of a backend URL, like `idPath()` for record
 * ids: the id comes from the browser, so only a real session id gets through
 * (no `..` or `/` to walk to another backend path), and it is encoded anyway.
 */
function sessionIdPath(id: string): string | null {
  return SESSION_ID.test(id) ? encodeURIComponent(id) : null;
}

export async function fetchMySessions(): Promise<SessionList | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/auth/sessions`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as SessionList) : null;
  } catch {
    return null;
  }
}

/**
 * Ends one session, or every other one. The backend asks for the password
 * again first (or a recent sign-in, for a Google-only account). Ending the
 * session this browser is using clears its cookie too.
 */
export async function endMySessions(target: { id: string; current: boolean } | "others", password: string): Promise<EndSessionsResult> {
  const segment = target === "others" ? null : sessionIdPath(target.id);
  if (target !== "others" && segment === null) return { ok: false, error: null, reauth: false };
  const path = target === "others" ? "sessions/end-others" : `sessions/${segment}/end`;
  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/${path}`, {
      method: "POST",
      headers: { ...(await authHeaders()), ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(password ? { password } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: null, reauth: false };
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { ok: false, error: typeof message === "string" ? message : null, reauth: data?.code === "reauth-required" };
  }
  const signedOut = target !== "others" && target.current;
  if (signedOut) (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return { ok: true, signedOut };
}

"use server";

import { getTranslations } from "next-intl/server";

import { clientIpHeaders } from "@/lib/client-ip";

/**
 * The emailed-link flows — password reset and email verification — called
 * from the pages that need them. Server actions rather than API routes: none
 * of these needs the session cookie, and the backend URL stays on the server.
 */

export type LinkResult =
  | { ok: true; status?: string }
  /** `httpStatus` is absent when the backend couldn't be reached. */
  | { ok: false; error: string; httpStatus?: number };

async function post(path: string, body: Record<string, string>): Promise<LinkResult> {
  const te = await getTranslations("Errors");
  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/${path}`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: te("connectionFailed") };
  }

  const data = await res.json().catch(() => null);
  if (res.status === 429) {
    return { ok: false, error: te("tooManyRequests"), httpStatus: 429 };
  }
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { ok: false, error: message ?? te("actionFailed"), httpStatus: res.status };
  }
  return { ok: true, status: typeof data?.status === "string" ? data.status : undefined };
}

export async function requestPasswordReset(email: string) {
  return post("password/forgot", { email: email.trim() });
}

export async function resetPassword(token: string, password: string) {
  return post("password/reset", { token, password });
}

export async function verifyEmail(token: string) {
  return post("email/verify", { token });
}

export async function resendVerification(email: string) {
  return post("email/resend", { email: email.trim() });
}

import { getTranslations } from "next-intl/server";

import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions, verifySessionToken } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { jsonResponse } from "@/lib/json-response";
import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Server-side relay for the passkey routes (staff sign-in, adding a passkey,
 * step-up). Unlike the general proxy it sends the browser's address, since
 * these routes have the tight sign-in rate limit and would otherwise share one
 * bucket for every user; and it saves the session the backend re-signs after
 * a passkey check.
 */
export async function relayPasskey(
  path: string,
  { method = "POST", body }: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
) {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, {
      method,
      headers: {
        ...(await authHeaders()),
        ...(await clientIpHeaders()),
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    const te = await getTranslations("Errors");
    return { ok: false as const, response: jsonResponse({ error: te("connectionFailed") }, { status: 502 }) };
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return {
      ok: false as const,
      response: jsonResponse({ error: message, code: data?.code }, { status: res.status }),
    };
  }
  return { ok: true as const, data };
}

/** Sets the re-signed session, keeping the cookie's lifetime to the token's own absolute expiry. */
export async function withSession(response: ReturnType<typeof jsonResponse>, token: unknown) {
  if (typeof token !== "string") return response;
  const session = await verifySessionToken(token);
  const secondsLeft = session ? session.exp - Math.floor(Date.now() / 1000) : SESSION_MAX_AGE;
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(Math.max(0, secondsLeft)));
  return response;
}

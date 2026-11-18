import { getTranslations } from "next-intl/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const te = await getTranslations("Errors");
  const body = await request.json().catch(() => null);

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google/complete`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return jsonResponse({ error: te("connectionFailed") }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);

  // Same race as googleAuth(): by the time this lands, the identity may
  // already exist (a second tab, or a matching email/password account that
  // just got linked) — in which case the company form no longer matters.
  if (backendRes.ok && data?.status === "pending") {
    return jsonResponse({ status: "pending", companyName: data.companyName });
  }

  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return jsonResponse(
      { error: message ?? te("submitFailed") },
      { status: backendRes.status || 400 },
    );
  }

  const response = jsonResponse({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return response;
}

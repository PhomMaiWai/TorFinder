import { getTranslations } from "next-intl/server";

import { clientIpHeaders } from "@/lib/client-ip";
import { clientDevice, rememberDevice } from "@/lib/device-cookie";
import { GOOGLE_NONCE_COOKIE, googleNonceCookieOptions, googleNonceFrom } from "@/lib/google-nonce";
import { jsonResponse } from "@/lib/json-response";
import { withSession } from "@/lib/passkey-relay";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const te = await getTranslations("Errors");
  const body = await request.json().catch(() => null);

  const device = await clientDevice();
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google/complete`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), ...device.headers, "Content-Type": "application/json" },
      // The nonce comes from this browser's cookie, never from the request body (ASVS 10.1.2).
      body: JSON.stringify({ ...(body && typeof body === "object" ? body : {}), nonce: googleNonceFrom(request) }),
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
  // The cookie lasts as long as the token: 12 hours from a new device (ASVS 8.2.4), else 7 days.
  await withSession(response, data.token);
  response.cookies.set(GOOGLE_NONCE_COOKIE, "", googleNonceCookieOptions(0));
  return rememberDevice(response, device);
}

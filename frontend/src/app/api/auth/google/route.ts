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
  const credential = typeof body?.credential === "string" ? body.credential : "";
  const as = body?.as === "viewer" ? "viewer" : undefined;

  if (!credential) {
    return jsonResponse({ error: te("googleLoginFailed") }, { status: 400 });
  }

  const device = await clientDevice();
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), ...device.headers, "Content-Type": "application/json" },
      // The nonce this browser gave Google; the backend refuses a token carrying any other (ASVS 10.1.2).
      body: JSON.stringify({ credential, as, nonce: googleNonceFrom(request) }),
    });
  } catch {
    return jsonResponse({ error: te("connectionFailed") }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);

  // A pending account (brand new, or an existing pending signup just linked
  // to this Google credential) isn't an error — it's a 200 with no token,
  // same shape as a successful /api/auth/signup response.
  if (backendRes.ok && data?.status === "pending") {
    return jsonResponse({ status: "pending", companyName: data.companyName });
  }

  // A Google identity we've never seen before, with nothing to link to —
  // Google verified who they are but never collected a company, so the
  // caller still needs to fill that in via /api/auth/google/complete.
  // A staff account with a passkey: Google proved who it is; the passkey still has to answer.
  if (backendRes.ok && data?.status === "passkey-required") {
    return jsonResponse({ status: "passkey-required", options: data.options });
  }

  if (backendRes.ok && data?.status === "needs-company-info") {
    return jsonResponse({
      status: "needs-company-info",
      email: data.email,
      name: data.name,
    });
  }

  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return jsonResponse(
      { error: message ?? te("loginFailed") },
      { status: backendRes.status || 401 },
    );
  }

  const response = jsonResponse({ user: data.user });
  // The cookie lasts as long as the token: 12 hours from a new device (ASVS 8.2.4), else 7 days.
  await withSession(response, data.token);
  // Used up: the next Google sign-in in this browser gets a new nonce.
  response.cookies.set(GOOGLE_NONCE_COOKIE, "", googleNonceCookieOptions(0));
  return rememberDevice(response, device);
}

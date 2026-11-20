import { getTranslations } from "next-intl/server";

import { clientIpHeaders } from "@/lib/client-ip";
import { clientDevice, rememberDevice } from "@/lib/device-cookie";
import { jsonResponse } from "@/lib/json-response";
import { withSession } from "@/lib/passkey-relay";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const te = await getTranslations("Errors");
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ error: te("emailPasswordRequired") }, { status: 400 });
  }

  const device = await clientDevice();
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), ...device.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return jsonResponse({ error: te("connectionFailed") }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);

  // A staff account with a passkey: the password was right, and the browser
  // now signs this challenge (POST /api/auth/passkey/login). No session yet.
  if (backendRes.ok && data?.status === "passkey-required") {
    return rememberDevice(jsonResponse({ status: "passkey-required", options: data.options }), device);
  }

  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return jsonResponse(
      { error: message ?? te("loginFailed"), code: data?.code },
      { status: backendRes.status || 401 },
    );
  }

  const response = jsonResponse({ user: data.user });
  // The cookie lasts as long as the token: 12 hours from a new device (ASVS 8.2.4), else 7 days.
  await withSession(response, data.token);
  return rememberDevice(response, device);
}

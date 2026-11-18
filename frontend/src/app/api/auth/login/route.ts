import { getTranslations } from "next-intl/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const te = await getTranslations("Errors");
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ error: te("emailPasswordRequired") }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return jsonResponse({ error: te("connectionFailed") }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return jsonResponse(
      { error: message ?? te("loginFailed"), code: data?.code },
      { status: backendRes.status || 401 },
    );
  }

  const response = jsonResponse({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return response;
}

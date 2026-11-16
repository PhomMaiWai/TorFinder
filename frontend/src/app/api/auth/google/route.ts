
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  const as = body?.as === "viewer" ? "viewer" : undefined;

  if (!credential) {
    return jsonResponse({ error: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ credential, as }),
    });
  } catch {
    return jsonResponse({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
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
      { error: message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" },
      { status: backendRes.status || 401 },
    );
  }

  const response = jsonResponse({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return response;
}

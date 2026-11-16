
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip";
import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonResponse({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return jsonResponse({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return jsonResponse(
      { error: message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่", code: data?.code },
      { status: backendRes.status || 401 },
    );
  }

  const response = jsonResponse({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return response;
}

import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";

  if (!credential) {
    return NextResponse.json({ error: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);

  // A pending account (brand new, or an existing pending signup just linked
  // to this Google credential) isn't an error — it's a 200 with no token,
  // same shape as a successful /api/auth/signup response.
  if (backendRes.ok && data?.status === "pending") {
    return NextResponse.json({ status: "pending", companyName: data.companyName });
  }

  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return NextResponse.json(
      { error: message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" },
      { status: backendRes.status || 401 },
    );
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

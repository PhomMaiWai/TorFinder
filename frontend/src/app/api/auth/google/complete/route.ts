import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/google/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);

  // Same race as googleAuth(): by the time this lands, the identity may
  // already exist (a second tab, or a matching email/password account that
  // just got linked) — in which case the company form no longer matters.
  if (backendRes.ok && data?.status === "pending") {
    return NextResponse.json({ status: "pending", companyName: data.companyName });
  }

  if (!backendRes.ok || !data?.token) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return NextResponse.json(
      { error: message ?? "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่" },
      { status: backendRes.status || 400 },
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

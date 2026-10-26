import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/api/notifications/channels`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request: Request) {
  const res = await fetch(`${BACKEND_URL}/api/notifications/channels`, {
    method: "PUT",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: await request.text(),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

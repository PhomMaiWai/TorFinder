import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${BACKEND_URL}/api/notifications/channels/test`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

import { NextResponse } from "next/server";

import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** The signed-in account's saved searches; the backend scopes them to the session. */
export async function GET() {
  const res = await fetch(`${BACKEND_URL}/api/saved-searches`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const res = await fetch(`${BACKEND_URL}/api/saved-searches`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

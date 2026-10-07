import { NextResponse } from "next/server";

import { authHeaders } from "@/lib/session-headers";

/**
 * Where the capture extension sends the project numbers an admin collected on
 * process5. The browser attaches the admin's session cookie; it travels on as
 * the bearer token the backend's admin guard checks.
 */
export async function POST(request: Request) {
  const res = await fetch(`${process.env.BACKEND_URL}/api/gproc/capture`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  return NextResponse.json(await res.json().catch(() => null), { status: res.status });
}

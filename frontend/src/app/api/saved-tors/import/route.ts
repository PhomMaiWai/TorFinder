import { NextResponse } from "next/server";

import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Folds this browser's pre-sign-in bookmarks into the account; answers with the merged list. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const torIds = Array.isArray(body?.torIds) ? body.torIds.map(String) : [];

  const res = await fetch(`${BACKEND_URL}/api/saved-tors/import`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ torIds }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

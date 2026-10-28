import { NextResponse } from "next/server";

import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND_URL}/api/saved-searches/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
    cache: "no-store",
  });

  // The backend answers 204 on success — nothing to parse.
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

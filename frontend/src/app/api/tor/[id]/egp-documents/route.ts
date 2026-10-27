import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Which documents the national e-GP holds for this announcement's project. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/egp-documents`, {
      signal: request.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(res.ok ? data : [], {
      status: res.ok ? 200 : res.status,
      // The backend caches e-GP's answer for an hour; let the browser reuse it briefly too.
      headers: res.ok ? { "Cache-Control": "private, max-age=300" } : undefined,
    });
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

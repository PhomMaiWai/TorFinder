import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const FORWARDED_HEADERS = ["content-type", "content-length", "content-disposition", "cache-control"];

/** Same-origin path to one of the national e-GP's copies, so the detail page can frame it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1" ? "?download=1" : "";

  let res: Response;
  try {
    res = await fetch(
      `${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/egp-documents/${encodeURIComponent(kind)}${download}`,
      { signal: request.signal, cache: "no-store" },
    );
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    return NextResponse.json({ error: data?.message ?? "เปิดเอกสารไม่สำเร็จ" }, { status: res.status || 502 });
  }

  const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
  for (const name of FORWARDED_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: 200, headers });
}

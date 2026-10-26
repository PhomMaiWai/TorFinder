import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Only what the browser needs to show or save a PDF; the backend's own security headers stay behind. */
const FORWARDED_HEADERS = ["content-type", "content-length", "content-disposition", "cache-control"];

/**
 * Same-origin path to an announcement's PDF, so the detail page can frame it.
 * The body is streamed straight through, never buffered here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1" ? "?download=1" : "";

  let res: Response;
  try {
    res = await fetch(
      `${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/documents/${encodeURIComponent(index)}${download}`,
      // The reader closing the viewer cancels the whole chain back to the portal.
      { signal: request.signal, cache: "no-store" },
    );
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    return NextResponse.json({ error: data?.message ?? "เปิดเอกสารไม่สำเร็จ" }, { status: res.status || 502 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(res.body, { status: 200, headers });
}

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** The PDFs and images inside a zipped bundle the announcement links to. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/documents/${encodeURIComponent(index)}/entries`,
      { signal: request.signal, cache: "no-store" },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.message ?? "เปิดชุดเอกสารไม่สำเร็จ" }, { status: res.status });
    // A published bundle doesn't change.
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }, { status: 502 });
  }
}

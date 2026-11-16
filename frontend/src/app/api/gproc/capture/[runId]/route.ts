
import { jsonResponse } from "@/lib/json-response";
import { authHeaders } from "@/lib/session-headers";

/** One capture's progress, polled by the extension's popup. */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const res = await fetch(`${process.env.BACKEND_URL}/api/gproc/capture/${encodeURIComponent(runId)}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  return jsonResponse(await res.json().catch(() => null), { status: res.status });
}

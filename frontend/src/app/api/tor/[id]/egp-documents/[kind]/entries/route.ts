import { getTranslations } from "next-intl/server";

import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** The PDFs and images inside a bundles the national e-GP publishes for the project. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  const te = await getTranslations("Errors");
  const { id, kind } = await params;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/egp-documents/${encodeURIComponent(kind)}/entries`,
      { signal: request.signal, cache: "no-store" },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) return jsonResponse({ error: data?.message ?? te("openDocumentSetFailed") }, { status: res.status });
    // A published bundle doesn't change.
    return jsonResponse(data, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return jsonResponse({ error: te("connectionFailedShort") }, { status: 502 });
  }
}

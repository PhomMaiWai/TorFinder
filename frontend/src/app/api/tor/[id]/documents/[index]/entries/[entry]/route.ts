import { getTranslations } from "next-intl/server";

import { jsonResponse } from "@/lib/json-response";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const FORWARDED_HEADERS = ["content-type", "content-length", "content-disposition", "cache-control"];

/** One file out of a zipped bundle, same-origin so the viewer can frame it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string; entry: string }> },
) {
  const te = await getTranslations("Errors");
  const { id, index, entry } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1" ? "?download=1" : "";

  let res: Response;
  try {
    res = await fetch(
      `${BACKEND_URL}/api/tor/${encodeURIComponent(id)}/documents/${encodeURIComponent(index)}/entries/${encodeURIComponent(entry)}${download}`,
      { signal: request.signal, cache: "no-store" },
    );
  } catch {
    return jsonResponse({ error: te("connectionFailedShort") }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    return jsonResponse({ error: data?.message ?? te("openFileFailed") }, { status: res.status || 502 });
  }

  const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
  for (const name of FORWARDED_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: 200, headers });
}

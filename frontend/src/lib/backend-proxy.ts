import { isPlainPath } from "@/lib/backend-path";
import { jsonResponse } from "@/lib/json-response";
import { authHeaders } from "@/lib/session-headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Only what the browser needs to save a file; the backend's other headers stay behind. */
const FILE_HEADERS = ["content-type", "content-length", "content-disposition"];

type Forward = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** The backend path below /api, already encoded — e.g. "/certificates/abc/file". */
  path: string;
  /** The browser's request, when its body (JSON or a multipart upload) goes along as-is. */
  request?: Request;
};

/** The proposal library's record kinds, as the backend's `LIBRARY_KINDS` names them. */
const LIBRARY_KINDS = new Set(["projects", "team"]);
export const isLibraryKind = (kind: string) => LIBRARY_KINDS.has(kind);

/** The answer for a malformed id or kind: the record can't exist, so the backend isn't asked. */
export const notFound = () => jsonResponse({ message: "ไม่พบรายการนี้" }, { status: 404 });

/**
 * Passes a call through to the backend with the caller's session. Bodies
 * stream through untouched — a 5 MB upload is never read into this server's
 * memory — and the backend does all the validating.
 */
export async function forwardToBackend({ method, path, request }: Forward): Promise<Response> {
  if (!isPlainPath(path)) return notFound();
  const headers = new Headers(await authHeaders());
  const contentType = request?.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, {
      method,
      headers,
      body: request && method !== "GET" && method !== "DELETE" ? request.body : undefined,
      // Required by Node's fetch to send a streamed body.
      ...(request?.body ? { duplex: "half" } : {}),
      signal: request?.signal,
      cache: "no-store",
    } as RequestInit);
  } catch {
    return jsonResponse({ message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }, { status: 502 });
  }

  if (res.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const data = await res.json().catch(() => null);
  return jsonResponse(data, { status: res.status });
}

/** A stored file (or a generated ZIP), streamed back as a download. */
export async function downloadFromBackend(path: string, request: Request): Promise<Response> {
  if (!isPlainPath(path)) return notFound();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: await authHeaders(),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return jsonResponse({ message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    return jsonResponse({ message: data?.message ?? "เปิดไฟล์ไม่สำเร็จ" }, { status: res.status || 502 });
  }

  const headers = new Headers({ "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
  for (const name of FILE_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: 200, headers });
}

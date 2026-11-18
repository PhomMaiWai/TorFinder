import { clientIpHeaders } from "@/lib/client-ip";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * LINE's webhook (set in the LINE Developers console as
 * https://<site>/api/line/webhook). The backend isn't reachable from outside,
 * so this hands the call over byte for byte: the signature LINE sent is over
 * the exact body, and the backend is the one that checks it. The caller's
 * address goes along so the backend's webhook rate limit counts each client
 * separately; without it a flood of forged calls would share one bucket with
 * LINE's real ones and crowd them out.
 */
export async function POST(request: Request) {
  const res = await fetch(`${BACKEND_URL}/api/line/webhook`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      "x-line-signature": request.headers.get("x-line-signature") ?? "",
      ...(await clientIpHeaders()),
    },
    body: await request.arrayBuffer(),
    cache: "no-store",
  }).catch(() => null);
  return new Response(null, { status: res?.status ?? 502 });
}

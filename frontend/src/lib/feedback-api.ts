import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth";
import type { TorFeedback } from "@/types/tor";

/** The moderation routes are guarded, so the caller's session travels with them. */
async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Every comment, or only those in one state — the queue asks for "รอตรวจสอบ". */
export async function fetchFeedbackQueue(
  status?: TorFeedback["status"],
): Promise<TorFeedback[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${process.env.BACKEND_URL}/api/feedback${query}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function reviewFeedback(
  id: string,
  status: Exclude<TorFeedback["status"], "รอตรวจสอบ">,
): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/feedback/${id}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("อัปเดตสถานะความคิดเห็นไม่สำเร็จ");
}

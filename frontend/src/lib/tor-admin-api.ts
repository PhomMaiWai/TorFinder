import { fetchJson, orEmptyWhenAnswered } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";
import type { TorRecord } from "@/types/tor";

/**
 * Announcements that have been hidden. Returns nothing for a caller who isn't
 * an admin — what was removed shouldn't be listed to everyone.
 */
export async function fetchDeletedTors(): Promise<TorRecord[]> {
  return orEmptyWhenAnswered(
    fetchJson<TorRecord[]>("/api/tor/deleted", { headers: await authHeaders() }),
    [],
  );
}

export async function deleteTor(id: string): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("ลบประกาศไม่สำเร็จ");
}

export async function restoreTor(id: string): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}/restore`, {
    method: "POST",
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("กู้คืนประกาศไม่สำเร็จ");
}

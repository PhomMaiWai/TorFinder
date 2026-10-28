"use server";

import { revalidatePath } from "next/cache";

import { authHeaders } from "@/lib/session-headers";

/**
 * Imports read whole listings one page at a time and then the detail page of
 * every new announcement, so they are slow by nature — but never unbounded.
 */
const TIMEOUT_MS = 180_000;

/**
 * The admin's manual retry after a failed or partial run — a single on-demand
 * attempt, not the scheduler's own bounded retry-with-backoff.
 */
export async function runEgpSyncAgain(): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/egp/sync`, {
    method: "POST",
    // The import route is admin-guarded, so the session travels with it.
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error("ดึงข้อมูลจากระบบ e-GP อีกครั้งไม่สำเร็จ");
  }

  revalidatePath("/admin");
}

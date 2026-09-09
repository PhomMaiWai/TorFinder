"use server";

import { revalidatePath } from "next/cache";

export async function syncFromEgp() {
  const res = await fetch(`${process.env.BACKEND_URL}/api/egp/sync`, {
    method: "POST",
    cache: "no-store",
    // The government feed is slow and pulled one department at a time.
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error("ดึงประกาศจากระบบ e-GP ไม่สำเร็จ");
  }

  revalidatePath("/admin/tor");
}

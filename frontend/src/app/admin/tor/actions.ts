"use server";

import { revalidatePath } from "next/cache";

import { authHeaders } from "@/lib/session-headers";
import { deleteTor, restoreTor } from "@/lib/tor-admin-api";

/** The portals an admin can pull from, named the way the failure is reported. */
const SOURCES = {
  egp: "ระบบ e-GP",
  mea: "เว็บไซต์จัดซื้อจัดจ้าง กฟน.",
  datagov: "ระบบข้อมูลเปิดภาครัฐ (data.go.th)",
} as const;

/**
 * Imports read whole listings one page at a time and then the detail page of
 * every new announcement, so they are slow by nature — but never unbounded.
 */
const TIMEOUT_MS = 180_000;

async function sync(source: keyof typeof SOURCES): Promise<void> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/${source}/sync`, {
    method: "POST",
    // The import route is admin-guarded, so the session travels with it.
    headers: await authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`ดึงประกาศจาก${SOURCES[source]}ไม่สำเร็จ`);
  }

  revalidatePath("/admin/tor");
}

export async function syncFromEgp() {
  await sync("egp");
}

export async function syncFromMea() {
  await sync("mea");
}

export async function syncFromDataGov() {
  await sync("datagov");
}

/** Hides an announcement from every listing; the owner's own page follows. */
export async function hideTor(id: string) {
  await deleteTor(id);
  revalidatePath("/admin/tor");
  revalidatePath("/owner");
}

export async function unhideTor(id: string) {
  await restoreTor(id);
  revalidatePath("/admin/tor");
  revalidatePath("/owner");
}

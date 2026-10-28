"use server";

import { redirect } from "next/navigation";

import { authHeaders } from "@/lib/session-headers";
import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export async function updateTorEntry(id: string, formData: FormData) {
  const values = parseTorFormData(formData);
  assertTorFormValid(values);

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error("อัปเดตรายการ TOR ไม่สำเร็จ");
  }

  // The owner link is its own call: it isn't a correction, so it locks nothing.
  const ownerId = String(formData.get("ownerId") ?? "");
  if (ownerId !== String(formData.get("currentOwnerId") ?? "")) {
    const owner = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}/owner`, {
      method: "PUT",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: ownerId || null }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!owner.ok) {
      throw new Error("กำหนดเจ้าของโครงการไม่สำเร็จ");
    }
  }

  redirect(`/admin/tor/${id}`);
}

"use server";

import { redirect } from "next/navigation";

import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export async function updateTorEntry(id: string, formData: FormData) {
  const values = parseTorFormData(formData);
  assertTorFormValid(values);

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error("อัปเดตรายการ TOR ไม่สำเร็จ");
  }

  redirect("/admin");
}

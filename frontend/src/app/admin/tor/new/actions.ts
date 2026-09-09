"use server";

import { redirect } from "next/navigation";

import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export async function createTorEntry(formData: FormData) {
  const values = parseTorFormData(formData);
  assertTorFormValid(values);

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error("บันทึกรายการ TOR ไม่สำเร็จ");
  }

  redirect("/admin");
}

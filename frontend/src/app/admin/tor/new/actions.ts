"use server";

import { redirect } from "next/navigation";

import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export type CreateTorState = { error?: string };

export async function createTorEntry(
  _prev: CreateTorState,
  formData: FormData,
): Promise<CreateTorState> {
  const values = parseTorFormData(formData);
  try {
    assertTorFormValid(values);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "กรอกข้อมูลให้ครบก่อนบันทึก" };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/tor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { error: message ?? "บันทึกรายการ TOR ไม่สำเร็จ" };
  }

  redirect("/admin");
}

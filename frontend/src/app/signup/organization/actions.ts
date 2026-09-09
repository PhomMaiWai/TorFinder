"use server";

import { redirect } from "next/navigation";

export type SignupState = { error?: string };

export async function signupOrganization(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const payload = Object.fromEntries(
    ["email", "password", "companyName", "taxId", "contactName", "phone", "address", "specialty", "size"].map(
      (field) => [field, String(formData.get(field) ?? "").trim()],
    ),
  );

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { error: message ?? "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่" };
  }

  redirect(`/signup/pending?name=${encodeURIComponent(payload.companyName)}`);
}

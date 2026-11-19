"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionResult, actionResultFrom } from "@/lib/action-result";
import { setReportStatus } from "@/lib/admin-api";
import { idPath } from "@/lib/backend-path";
import { authHeaders } from "@/lib/session-headers";
import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export async function updateTorEntry(id: string, formData: FormData): Promise<ActionResult> {
  const values = parseTorFormData(formData);
  assertTorFormValid(values);

  // The owner link is its own call: it isn't a correction, so it locks nothing.
  // It goes first because it may ask for a fresh passkey check (ASVS 7.5.3):
  // a refused or cancelled check then leaves the record untouched, and the
  // retry after it saves everything at once.
  const ownerId = String(formData.get("ownerId") ?? "");
  if (ownerId !== String(formData.get("currentOwnerId") ?? "")) {
    const owner = await fetch(`${process.env.BACKEND_URL}/api/tor/${idPath(id)}/owner`, {
      method: "PUT",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: ownerId || null }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!owner.ok) return actionResultFrom(owner, "กำหนดเจ้าของโครงการไม่สำเร็จ");
  }

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${idPath(id)}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return actionResultFrom(res, "อัปเดตรายการ TOR ไม่สำเร็จ");

  // Opened from a report ("Fix this TOR"): saving the correction closes it, and
  // the admin goes back to the reports still waiting.
  const reportId = String(formData.get("reportId") ?? "");
  if (reportId) {
    await setReportStatus(reportId, "resolved", true);
    revalidatePath("/admin/reports");
    redirect("/admin/reports");
  }

  redirect(`/admin/tor/${id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionResult, actionResultFrom } from "@/lib/action-result";
import { setReportStatus } from "@/lib/admin-api";
import { idPath } from "@/lib/backend-path";
import { authHeaders } from "@/lib/session-headers";
import { parseExtractionFormData } from "@/lib/extraction-form";
import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export async function updateTorEntry(id: string, formData: FormData): Promise<ActionResult> {
  const values = parseTorFormData(formData);
  assertTorFormValid(values);
  // Checked before anything is saved, so a typo in a figure doesn't leave half the form written.
  const extraction = parseExtractionFormData(formData);
  if (extraction && "error" in extraction) return { error: extraction.error };

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${idPath(id)}`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return actionResultFrom(res, "อัปเดตรายการ TOR ไม่สำเร็จ");

  // The admin's review of what the AI read off the document, when the record has one.
  if (extraction) {
    const reviewed = await fetch(`${process.env.BACKEND_URL}/api/tor/${idPath(id)}/extraction`, {
      method: "PATCH",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(extraction.payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!reviewed.ok) return actionResultFrom(reviewed, "บันทึกข้อมูลที่ตรวจทานจาก AI ไม่สำเร็จ");
  }

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

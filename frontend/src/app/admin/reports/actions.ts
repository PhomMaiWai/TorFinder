"use server";

import { revalidatePath } from "next/cache";

import { setReportStatus } from "@/lib/admin-api";

export async function resolveReport(id: string) {
  await setReportStatus(id, "resolved");
  revalidatePath("/admin/reports");
}

export async function reopenReport(id: string) {
  await setReportStatus(id, "open");
  revalidatePath("/admin/reports");
}

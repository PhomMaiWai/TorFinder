"use server";

import { revalidatePath } from "next/cache";

import { reviewFeedback } from "@/lib/feedback-api";

export async function approveFeedback(id: string) {
  await reviewFeedback(id, "อนุมัติ");
  revalidatePath("/admin/moderation");
}

export async function rejectFeedback(id: string) {
  await reviewFeedback(id, "ปฏิเสธ");
  revalidatePath("/admin/moderation");
}

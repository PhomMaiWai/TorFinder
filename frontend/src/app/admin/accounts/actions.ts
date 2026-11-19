"use server";

import { revalidatePath } from "next/cache";

import { reviewAccount } from "@/lib/accounts-api";

/** Returns the backend's refusal (or a step-up request) rather than throwing; see ActionResult. */
async function review(id: string, status: "approved" | "rejected") {
  const result = await reviewAccount(id, status);
  if (!result.error) revalidatePath("/admin/accounts");
  return result;
}

export async function approveAccount(id: string) {
  return review(id, "approved");
}

export async function rejectAccount(id: string) {
  return review(id, "rejected");
}

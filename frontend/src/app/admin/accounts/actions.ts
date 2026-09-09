"use server";

import { revalidatePath } from "next/cache";

import { reviewAccount } from "@/lib/accounts-api";

export async function approveAccount(id: string) {
  await reviewAccount(id, "approved");
  revalidatePath("/admin/accounts");
}

export async function rejectAccount(id: string) {
  await reviewAccount(id, "rejected");
  revalidatePath("/admin/accounts");
}

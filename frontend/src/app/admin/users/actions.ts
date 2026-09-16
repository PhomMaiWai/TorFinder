"use server";

import { revalidatePath } from "next/cache";

import { reviewAccount } from "@/lib/accounts-api";

/**
 * Suspending is the same decision as rejecting an application — one account
 * status, whether it is set on the way in or later — so both screens go through
 * the one endpoint rather than inventing a second state to keep in step.
 */
export async function suspendAccount(id: string) {
  await reviewAccount(id, "rejected");
  revalidatePath("/admin/users");
}

export async function reactivateAccount(id: string) {
  await reviewAccount(id, "approved");
  revalidatePath("/admin/users");
}

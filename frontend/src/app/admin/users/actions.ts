"use server";

import { revalidatePath } from "next/cache";

import { reactivateUser, suspendUser } from "@/lib/admin-api";

export async function suspendAccount(id: string) {
  await suspendUser(id);
  revalidatePath("/admin/users");
}

export async function reactivateAccount(id: string) {
  await reactivateUser(id);
  revalidatePath("/admin/users");
}

"use server";

import { revalidatePath } from "next/cache";

import { reactivateUser, suspendUser, updateUser, type UserEdit } from "@/lib/admin-api";

export async function suspendAccount(id: string) {
  await suspendUser(id);
  revalidatePath("/admin/users");
}

export async function reactivateAccount(id: string) {
  await reactivateUser(id);
  revalidatePath("/admin/users");
}

export async function editAccount(id: string, edit: UserEdit) {
  const result = await updateUser(id, edit);
  if (!result.error) revalidatePath("/admin/users");
  return result;
}

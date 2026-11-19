"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import {
  reactivateUser,
  resetUserPasskeys,
  sendUserResetLink,
  suspendUser,
  updateUser,
  type UserEdit,
} from "@/lib/admin-api";

/** Each returns the backend's refusal (or a step-up request) rather than throwing; see ActionResult. */
async function done(result: ActionResult): Promise<ActionResult> {
  if (!result.error) revalidatePath("/admin/users");
  return result;
}

export async function suspendAccount(id: string) {
  return done(await suspendUser(id));
}

export async function reactivateAccount(id: string) {
  return done(await reactivateUser(id));
}

export async function editAccount(id: string, edit: UserEdit) {
  return done(await updateUser(id, edit));
}

export async function resetAccountPasskeys(id: string) {
  return done(await resetUserPasskeys(id));
}

/** Changes nothing on the page, so there is nothing to revalidate. */
export async function sendAccountResetLink(id: string) {
  return sendUserResetLink(id);
}

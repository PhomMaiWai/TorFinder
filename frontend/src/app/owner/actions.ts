"use server";

import { revalidatePath } from "next/cache";

import { deleteTor, restoreTor } from "@/lib/tor-admin-api";

export async function hideTor(id: string) {
  await deleteTor(id);
  revalidatePath("/owner");
}

export async function unhideTor(id: string) {
  await restoreTor(id);
  revalidatePath("/owner");
}

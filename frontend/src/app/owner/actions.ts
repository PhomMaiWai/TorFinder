"use server";

import { revalidatePath } from "next/cache";

import { deleteTor, restoreTor } from "@/lib/tor-admin-api";

/** Both the owner view and the admin list show these records, so both refresh. */
function revalidateListings() {
  revalidatePath("/owner");
  revalidatePath("/admin/tor");
}

export async function hideTor(id: string) {
  await deleteTor(id);
  revalidateListings();
}

export async function unhideTor(id: string) {
  await restoreTor(id);
  revalidateListings();
}

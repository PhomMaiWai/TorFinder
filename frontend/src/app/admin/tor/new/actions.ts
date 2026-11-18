"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { authHeaders } from "@/lib/session-headers";
import { assertTorFormValid, parseTorFormData } from "@/lib/tor-form";

export type CreateTorState = { error?: string };

export async function createTorEntry(
  _prev: CreateTorState,
  formData: FormData,
): Promise<CreateTorState> {
  const te = await getTranslations("Errors");
  const values = parseTorFormData(formData);
  try {
    assertTorFormValid(values);
  } catch {
    // The only thing assertTorFormValid refuses is a missing required field.
    return { error: te("fillAllFields") };
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/tor`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(values),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: te("connectionFailed") };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { error: message ?? te("saveTorFailed") };
  }

  redirect("/admin");
}

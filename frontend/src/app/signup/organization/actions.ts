"use server";

import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clientIpHeaders } from "@/lib/client-ip";
import { formTokenHeader } from "@/lib/form-timing";
import { SIGNUP_EMAIL_COOKIE, signupEmailCookieOptions } from "@/lib/signup-email";

export type SignupState = { error?: string };

export async function signupOrganization(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const te = await getTranslations("Errors");
  const payload = Object.fromEntries(
    ["email", "password", "companyName", "taxId", "contactName", "phone", "address", "specialty", "size"].map(
      // The password goes exactly as typed: trimming it here but not at login
      // would lock out anyone whose password starts or ends with a space (ASVS 6.2.8).
      (field) => {
        const value = String(formData.get(field) ?? "");
        return [field, field === "password" ? value : value.trim()];
      },
    ),
  );

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/api/auth/signup`, {
      method: "POST",
      headers: { ...(await clientIpHeaders()), ...formTokenHeader(formData), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: te("connectionFailed") };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return { error: message ?? te("signupFailed") };
  }

  // The email marks a password sign-up: its address still has to be confirmed
  // (Google's already is). It goes in a short-lived cookie, not the URL (ASVS 14.2.1).
  (await cookies()).set(SIGNUP_EMAIL_COOKIE, payload.email, signupEmailCookieOptions);
  redirect(`/signup/pending?name=${encodeURIComponent(payload.companyName)}`);
}

import { cookies } from "next/headers";
import { Suspense } from "react";

import { SIGNUP_EMAIL_COOKIE } from "@/lib/signup-email";

import { PendingCard } from "./pending-card";

/**
 * Reads the address the sign-up just used from its short-lived cookie, so it
 * never travels in the URL, browser history or access logs (ASVS 14.2.1).
 */
export default async function SignupPendingPage() {
  const email = (await cookies()).get(SIGNUP_EMAIL_COOKIE)?.value ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <Suspense>
        <PendingCard email={email} />
      </Suspense>
    </main>
  );
}

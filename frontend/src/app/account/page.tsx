import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { PasskeySection } from "@/components/account/passkey-section";
import { SessionsSection } from "@/components/account/sessions-section";
import { ChangePasswordSection } from "@/components/profile/change-password";
import { SESSION_COOKIE, isStaffRole, needsPasskeySetup, verifySessionToken } from "@/lib/auth";

import { fetchMySessions } from "./actions";

/**
 * The signed-in account's own sign-in settings. Every account sees where it is
 * signed in and can end those sessions (ASVS 7.5.2). Every role with a password
 * changes it here (ASVS 6.2.2 / 6.2.3): /profile is the company's workspace and
 * org-only. A viewer signs in with Google only, so has no password section.
 * Staff and companies manage their passkeys here; while passkeys are
 * required, a staff member without one is sent here first (proxy.ts).
 */
export default async function AccountPage() {
  const [t, session, sessions] = await Promise.all([
    getTranslations("AccountPage"),
    cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value)),
    fetchMySessions(),
  ]);

  return (
    <AppShell role={session?.role}>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PageBody>
        <div className="max-w-2xl space-y-8">
          {(isStaffRole(session?.role) || session?.role === "org") && (
            <PasskeySection setupRequired={needsPasskeySetup(session)} forCompany={session?.role === "org"} />
          )}
          <SessionsSection list={sessions} />
          {session?.role !== "viewer" && <ChangePasswordSection />}
        </div>
      </PageBody>
    </AppShell>
  );
}

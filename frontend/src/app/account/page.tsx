import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { PasskeySection } from "@/components/account/passkey-section";
import { ChangePasswordSection } from "@/components/profile/change-password";
import { SESSION_COOKIE, isStaffRole, needsPasskeySetup, verifySessionToken } from "@/lib/auth";

/**
 * The signed-in account's own sign-in settings (ASVS 6.2.2 / 6.2.3), for every
 * role that has a password: /profile is the company's workspace and org-only,
 * so admin, owner and auditor change theirs here. proxy.ts keeps guests out and
 * sends a viewer home (viewers sign in with Google only and have no password).
 * Staff also manage their passkeys here; while passkeys are required, a staff
 * member without one is sent here first (proxy.ts).
 */
export default async function AccountPage() {
  const [t, session] = await Promise.all([
    getTranslations("AccountPage"),
    cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value)),
  ]);

  return (
    <AppShell role={session?.role}>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PageBody>
        <div className="max-w-2xl space-y-8">
          {(isStaffRole(session?.role) || session?.role === "org") && (
            <PasskeySection setupRequired={needsPasskeySetup(session)} forCompany={session?.role === "org"} />
          )}
          <ChangePasswordSection />
        </div>
      </PageBody>
    </AppShell>
  );
}

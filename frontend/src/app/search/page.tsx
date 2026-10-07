import { getTranslations } from "next-intl/server";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { TorSearch } from "@/components/public/tor-search";
import { toSearchCards } from "@/lib/tor-cards";
import { getAllTors } from "@/lib/tor-source";

/**
 * The same search as /public, inside the signed-in app: the sidebar stays, and
 * a TOR opened from here keeps it too.
 */
export default async function SearchPage() {
  const [allTors, t] = await Promise.all([getAllTors(), getTranslations("PublicPage")]);

  return (
    <AppShell>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PageBody>
        <TorSearch tors={toSearchCards(allTors)} inApp />
      </PageBody>
    </AppShell>
  );
}

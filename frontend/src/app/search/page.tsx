import { getTranslations } from "next-intl/server";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { TorSearch } from "@/components/public/tor-search";
import { filtersFromParams } from "@/lib/search-filters";
import { FEATURED_IDS, toSearchCards } from "@/lib/tor-cards";
import { getAllTors } from "@/lib/tor-source";

/**
 * The same search as /public, inside the signed-in app: the sidebar stays, and
 * a TOR opened from here keeps it too.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [allTors, t, params] = await Promise.all([
    getAllTors(),
    getTranslations("PublicPage"),
    searchParams,
  ]);

  return (
    <AppShell>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PageBody>
        <TorSearch
          tors={toSearchCards(allTors)}
          inApp
          initialFilters={filtersFromParams(params)}
          pinnedIds={FEATURED_IDS}
        />
      </PageBody>
    </AppShell>
  );
}

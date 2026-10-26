import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { TorSearch } from "@/components/public/tor-search";
import { FEATURED_IDS, toSearchCards } from "@/lib/tor-cards";
import { DEFAULT_SORT, isSortKey } from "@/lib/tor-sort";
import { getAllTors } from "@/lib/tor-source";

export default async function PublicPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [allTors, t, { sort }] = await Promise.all([
    getAllTors(),
    getTranslations("PublicPage"),
    searchParams,
  ]);
  const tors = toSearchCards(allTors);

  return (
    <div className="flex min-h-screen flex-col bg-surface-alt">
      <SiteNavbar />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-2 text-base text-ink-muted">{t("pageDescription")}</p>
          </div>

          <TorSearch
            tors={tors}
            initialSort={isSortKey(sort) ? sort : DEFAULT_SORT}
            pinnedIds={FEATURED_IDS}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

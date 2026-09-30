import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { TorSearch } from "@/components/public/tor-search";
import { getAllTors } from "@/lib/tor-source";
import type { TorRecord } from "@/types/tor";

/**
 * Comma-separated ids that lead the list, in that order — the announcements a
 * walkthrough opens first. Unset, the list keeps the order the backend returns.
 */
const FEATURED_IDS = (process.env.FEATURED_TOR_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function featuredFirst(tors: TorRecord[]): TorRecord[] {
  if (FEATURED_IDS.length === 0) return tors;
  const rank = (tor: TorRecord) => {
    const at = FEATURED_IDS.indexOf(tor.id);
    return at === -1 ? FEATURED_IDS.length : at;
  };
  return [...tors].sort((a, b) => rank(a) - rank(b));
}

export default async function PublicPage() {
  const [allTors, t] = await Promise.all([getAllTors(), getTranslations("PublicPage")]);
  const tors = featuredFirst(allTors);

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

          <TorSearch tors={tors} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

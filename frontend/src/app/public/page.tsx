import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { TorSearch } from "@/components/public/tor-search";
import { getAllTors } from "@/lib/tor-source";
import { biddingOf, daysUntilClose } from "@/lib/tor-ui";
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

/**
 * Only what a search card reads. Everything else — the model's extraction above
 * all — would be serialized into the page for every record and shipped to the
 * browser just to be ignored.
 */
/**
 * What a bidder can still act on comes first, the one closing soonest at the
 * very top; an open record with no known date follows the dated ones. The rest
 * keep the order they arrived in — `sort` is stable.
 */
function openFirst(tors: TorRecord[]): TorRecord[] {
  const closingRank = (tor: TorRecord) =>
    biddingOf(tor).status === "open" ? (daysUntilClose(tor) ?? Number.MAX_SAFE_INTEGER) : Infinity;
  return [...tors].sort((a, b) => {
    const [ra, rb] = [closingRank(a), closingRank(b)];
    return ra === rb ? 0 : ra < rb ? -1 : 1;
  });
}

function toCard(tor: TorRecord): TorRecord {
  return {
    id: tor.id,
    title: tor.title,
    agency: tor.agency,
    budget: tor.budget,
    deadline: tor.deadline,
    daysLeft: tor.daysLeft,
    match: tor.match,
    tags: tor.tags,
    stage: tor.stage,
    summary: tor.summary,
    budgetStatus: tor.budgetStatus,
    createdAt: tor.createdAt,
    isNew: tor.isNew,
    hasVendorMismatch: tor.hasVendorMismatch,
    sourceUrl: tor.sourceUrl,
    awardedAmount: tor.awardedAmount,
    referencePrice: tor.referencePrice,
    // The card links to the announcement's page; the file list is only its
    // fallback, and a third of the payload when sent for every record.
    documents: tor.sourceUrl ? undefined : tor.documents,
    bidding: tor.bidding,
  };
}

export default async function PublicPage() {
  const [allTors, t] = await Promise.all([getAllTors(), getTranslations("PublicPage")]);
  // Open announcements lead; a featured walkthrough order applies within the rest.
  const tors = openFirst(featuredFirst(allTors)).map(toCard);

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

import type { TorRecord } from "@/types/tor";

/**
 * Comma-separated ids that lead the list, in that order — the announcements a
 * walkthrough opens first. The search applies them on top of whichever sort the
 * reader picks (see sortTors).
 */
export const FEATURED_IDS = (process.env.FEATURED_TOR_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Only what a search card reads. Everything else — the model's extraction above
 * all — would be serialized into the page for every record and shipped to the
 * browser just to be ignored.
 */
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
    projectNumber: tor.projectNumber,
    awardedAmount: tor.awardedAmount,
    referencePrice: tor.referencePrice,
    // The card links to the announcement's page; the file list is only its
    // fallback, and a third of the payload when sent for every record.
    documents: tor.sourceUrl ? undefined : tor.documents,
    bidding: tor.bidding,
  };
}

/** What every search page hands the client, trimmed to what a card reads; the search orders it. */
export function toSearchCards(tors: TorRecord[]): TorRecord[] {
  return tors.map(toCard);
}

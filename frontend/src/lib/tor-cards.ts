import type { TorRecord } from "@/types/tor";

/**
 * Comma-separated ids that lead the list, in that order — the announcements a
 * walkthrough opens first. They lead within their open/closed tier, on top of
 * whichever sort the reader picks (see sortTors).
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
/**
 * A card clamps the summary to two lines, yet it was over half of what the
 * search page shipped (~600 KB for 665 records). This keeps comfortably more
 * than two lines show, cut on a grapheme boundary so a Thai vowel or tone mark
 * is never split from its consonant.
 */
const CARD_SUMMARY_CHARS = 220;
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

function cardSummary(summary: string): string {
  if (summary.length <= CARD_SUMMARY_CHARS) return summary;
  let end = 0;
  for (const { index, segment } of graphemes.segment(summary)) {
    if (index + segment.length > CARD_SUMMARY_CHARS) break;
    end = index + segment.length;
  }
  return `${summary.slice(0, end).trimEnd()}…`;
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
    summary: cardSummary(tor.summary),
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
    // Decides whether the card still offers a comment, and says until when.
    feedbackDeadline: tor.feedbackDeadline,
  };
}

/** What every search page hands the client, trimmed to what a card reads; the search orders it. */
export function toSearchCards(tors: TorRecord[]): TorRecord[] {
  return tors.map(toCard);
}

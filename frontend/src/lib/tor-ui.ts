import type { Bidding, TorRecord, TorStage } from "@/types/tor";

/** What the backend stores when the e-GP announcement doesn't carry the value. */
export const UNKNOWN_VALUE = "ไม่ระบุ";

export function isKnown(value: string | undefined): boolean {
  return !!value && value !== UNKNOWN_VALUE;
}

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export type AmountKind = "budget" | "awarded" | "reference";

/**
 * The money an announcement carries, and which of three things it is. A
 * winning-bidder notice has no budget to publish — the bidding is over — so it
 * carries what the contract was awarded for instead; the national e-GP prints
 * only the reference price (ราคากลาง). Showing either under "งบประมาณโครงการ"
 * would be calling one number by another's name.
 */
export function torAmount(tor: Pick<TorRecord, "budget" | "awardedAmount" | "referencePrice">): {
  value: string;
  kind: AmountKind;
} {
  if (isKnown(tor.budget)) return { value: tor.budget, kind: "budget" };
  if (tor.awardedAmount) return { value: BAHT.format(tor.awardedAmount), kind: "awarded" };
  if (tor.referencePrice) return { value: BAHT.format(tor.referencePrice), kind: "reference" };
  return { value: UNKNOWN_VALUE, kind: "budget" };
}

type DeadlineFields = Pick<TorRecord, "deadline" | "daysLeft" | "stage" | "bidding">;

const DAY_MS = 86_400_000;

/**
 * Whether the announcement still takes bids or comments. The backend decides
 * for every real record; the showcase records only carry a deadline, so theirs
 * is read from that the same way — an award is closed, a known date decides,
 * and anything else stays unknown.
 */
export function biddingOf(tor: DeadlineFields): Bidding {
  if (tor.bidding) return tor.bidding;
  if (tor.stage === "ประกาศผู้ชนะ") {
    return { status: "closed", reason: "awarded", opensAt: null, closesAt: null, closesAtSource: null };
  }
  if (isKnown(tor.deadline)) {
    return {
      status: tor.daysLeft > 0 ? "open" : "closed",
      reason: "deadline",
      opensAt: null,
      closesAt: null,
      closesAtSource: "portal",
    };
  }
  return { status: "unknown", reason: null, opensAt: null, closesAt: null, closesAtSource: null };
}

/** Bangkok is UTC+7 all year. */
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** The calendar day in Bangkok, as a running count — so "today" ends at Bangkok midnight. */
function bangkokDay(ms: number): number {
  return Math.floor((ms + BANGKOK_OFFSET_MS) / DAY_MS);
}

/**
 * Calendar days until it closes — 0 on the closing day itself, 1 the day
 * before — or null when no closing date is known. Counting 24-hour spans
 * instead would call a TOR closing at noon today "1 day left" this morning.
 */
export function daysUntilClose(tor: DeadlineFields): number | null {
  const { closesAt } = biddingOf(tor);
  if (closesAt) {
    const now = Date.now();
    return Math.max(0, bangkokDay(new Date(closesAt).getTime()) - bangkokDay(now));
  }
  return isKnown(tor.deadline) ? tor.daysLeft : null;
}

export function isClosed(tor: DeadlineFields): boolean {
  return biddingOf(tor).status === "closed";
}

/** Still open, and closing within a week. */
export function isClosingSoon(tor: DeadlineFields): boolean {
  if (biddingOf(tor).status !== "open") return false;
  const days = daysUntilClose(tor);
  return days !== null && days <= 7;
}

/**
 * "Closing within" buckets the search filter offers, nested rather than
 * exclusive — 30 days includes everything 7 days does — so a reader picks
 * one, with an explicit "any" (`null`) to reset, not a set of checkboxes.
 */
export const DEADLINE_RANGES = [
  { id: "7d", labelKey: "deadlineWithin7Days", days: 7 },
  { id: "30d", labelKey: "deadlineWithin30Days", days: 30 },
] as const;

/**
 * Whether `tor` closes within `rangeId`'s window — `null` (any) always
 * matches. Only something still open has a deadline worth filtering on: a
 * closed or awarded record's old closing date isn't a reason to surface it
 * among what a reader could still act on soon.
 */
export function matchesDeadline(tor: DeadlineFields, rangeId: string | null): boolean {
  if (rangeId === null) return true;
  const range = DEADLINE_RANGES.find((r) => r.id === rangeId);
  if (!range || biddingOf(tor).status !== "open") return false;
  const days = daysUntilClose(tor);
  return days !== null && days <= range.days;
}

/** Archives and web pages a reader can't open as a document in the browser. */
const NOT_A_DOCUMENT = /\.(zip|rar|html?)$/i;

/** The national e-GP's page for one project, by its 11-digit number. */
const EGP_PROJECT_PAGE = "https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=";
const MEA_PORTAL = /procurement\.mea\.or\.th/;

/**
 * Where "view original" should go. MEA's portal shows only its own copy of an
 * announcement, so an MEA record that carries its e-GP project number opens
 * the national e-GP instead — the official record, with the whole paper trail.
 * Everything else keeps the page it was imported from.
 */
export function sourcePageUrl(tor: Pick<TorRecord, "sourceUrl" | "projectNumber">): string | undefined {
  if (tor.sourceUrl && MEA_PORTAL.test(tor.sourceUrl) && tor.projectNumber && /^\d{11}$/.test(tor.projectNumber)) {
    return EGP_PROJECT_PAGE + tor.projectNumber;
  }
  return tor.sourceUrl;
}

/**
 * The file to open for "เอกสารประกาศ". An MEA announcement's link is its web
 * page, not a document, so an attached file wins — the TOR itself first, since
 * that is what a bidder came to read. Falls back to the announcement's link
 * when nothing attached opens in a browser.
 */
export function torDocumentUrl(tor: Pick<TorRecord, "documents" | "sourceUrl">): string | undefined {
  const readable = (tor.documents ?? []).filter((doc) => !NOT_A_DOCUMENT.test(doc.url));
  const torFile = readable.find((doc) => /TOR|ขอบเขต/i.test(doc.label));
  return (torFile ?? readable[0])?.url ?? tor.sourceUrl ?? undefined;
}

export function stageBadgeCls(stage: TorStage): string {
  if (stage === "ประกาศผู้ชนะ") return "bg-purple-50 text-purple-700";
  if (stage === "เปิดรับฟังความคิดเห็น") return "bg-amber-50 text-amber-700";
  if (stage === "แผนการจัดซื้อจัดจ้าง") return "bg-slate-100 text-slate-700";
  if (stage === "ประกาศราคากลาง") return "bg-sky-50 text-sky-700";
  return "bg-accent-soft text-accent";
}

/**
 * Project-size bands, half-open: a value counts in [min, max). Shared by the
 * search filter and the overview's size chart so the two can never disagree.
 */
export const BUDGET_RANGES = [
  { id: "under-500k", labelKey: "budgetRangeUnder500k", min: 0, max: 500_000 },
  { id: "500k-1m", labelKey: "budgetRange500kTo1m", min: 500_000, max: 1_000_000 },
  { id: "1m-3m", labelKey: "budgetRange1to3m", min: 1_000_000, max: 3_000_000 },
  { id: "3m-5m", labelKey: "budgetRange3to5m", min: 3_000_000, max: 5_000_000 },
  { id: "5m-10m", labelKey: "budgetRange5to10m", min: 5_000_000, max: 10_000_000 },
  { id: "over-10m", labelKey: "budgetRangeOver10m", min: 10_000_000, max: Infinity },
] as const;

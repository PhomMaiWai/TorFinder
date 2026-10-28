import { biddingOf, daysUntilClose, isKnown } from "@/lib/tor-ui";
import type { TorRecord } from "@/types/tor";

/**
 * How the search results are ordered. The default puts what closes soonest
 * first among the announcements still open, so nothing a reader could still
 * bid on runs out unseen; "prepare" — open with time to spare — is one click away.
 */
export const SORT_KEYS = ["prepare", "newest", "closing", "budget"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const DEFAULT_SORT: SortKey = "closing";

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

/** Fewer days left than this is too little to put a proposal together. */
export const MIN_PREP_DAYS = 3;

export type SortFields = Pick<
  TorRecord,
  "budget" | "deadline" | "daysLeft" | "stage" | "bidding" | "createdAt" | "referencePrice" | "awardedAmount"
>;

/** null when the announcement doesn't state a budget. */
export function parseBudget(budget: string): number | null {
  if (!isKnown(budget)) return null;
  const digits = budget.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

/** When the window opened: the announcement that opened it, else when the record arrived. */
export function openedAt(tor: SortFields): number {
  const time = Date.parse(biddingOf(tor).opensAt ?? tor.createdAt);
  return Number.isNaN(time) ? 0 : time;
}

/** The amount the card shows: the budget, else the reference price, else what it was awarded for. */
export function amountOf(tor: SortFields): number | null {
  return parseBudget(tor.budget) ?? tor.referencePrice ?? tor.awardedAmount ?? null;
}

/**
 * Bands for the default order: open with time to prepare, open with no known
 * closing date, open but closing within MIN_PREP_DAYS, unknown, closed. A TOR
 * closing tomorrow is still shown — only no longer first.
 */
function prepareBand(tor: SortFields): number {
  const { status } = biddingOf(tor);
  if (status === "closed") return 4;
  if (status === "unknown") return 3;
  const days = daysUntilClose(tor);
  if (days === null) return 1;
  return days >= MIN_PREP_DAYS ? 0 : 2;
}

/** Open first, then unknown, then closed — what every order keeps apart. */
function actionBand(tor: SortFields): number {
  const { status } = biddingOf(tor);
  return status === "open" ? 0 : status === "unknown" ? 1 : 2;
}

const newestFirst = (a: SortFields, b: SortFields) => openedAt(b) - openedAt(a);

const COMPARE: Record<SortKey, (a: SortFields, b: SortFields) => number> = {
  prepare: (a, b) => prepareBand(a) - prepareBand(b) || newestFirst(a, b),
  newest: (a, b) => actionBand(a) - actionBand(b) || newestFirst(a, b),
  closing: (a, b) => {
    const band = actionBand(a) - actionBand(b);
    if (band) return band;
    const [da, db] = [daysUntilClose(a), daysUntilClose(b)];
    // A known closing date before an unknown one.
    if (da !== db) return da === null ? 1 : db === null ? -1 : da - db;
    return newestFirst(a, b);
  },
  budget: (a, b) => {
    const [ma, mb] = [amountOf(a), amountOf(b)];
    if (ma !== mb) return ma === null ? 1 : mb === null ? -1 : mb - ma;
    return actionBand(a) - actionBand(b) || newestFirst(a, b);
  },
};

/**
 * What leads every order: announcements still taking proposals, then drafts
 * still open for comment, then everything else. A reader comes to find what
 * they can still bid on; nothing — not a pin, not a big budget — goes above it.
 */
function openTier(tor: SortFields): number {
  if (biddingOf(tor).status !== "open") return 2;
  return tor.stage === "ประกาศ TOR" ? 0 : 1;
}

/**
 * A sorted copy. `pinned` ids — the walkthrough records a demo opens first —
 * lead within their tier, so a pinned record that has since closed no longer
 * sits above the ones that are open.
 */
export function sortTors<T extends SortFields & { id: string }>(
  tors: readonly T[],
  key: SortKey,
  pinned: readonly string[] = [],
): T[] {
  const pin = (tor: T) => {
    const at = pinned.indexOf(tor.id);
    return at === -1 ? pinned.length : at;
  };
  return [...tors].sort((a, b) => openTier(a) - openTier(b) || pin(a) - pin(b) || COMPARE[key](a, b));
}

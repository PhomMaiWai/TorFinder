import { openedAt } from "@/lib/tor-sort";
import { biddingOf, daysUntilClose } from "@/lib/tor-ui";
import type { TorRecord } from "@/types/tor";

/**
 * The numbers behind the dashboard charts, kept free of React so each one can
 * be checked on its own. Every figure is computed from the same helpers the
 * cards use (`openedAt`, `daysUntilClose`), so a chart can never
 * disagree with the list under it.
 */

export type StatTor = Pick<
  TorRecord,
  | "agency"
  | "budget"
  | "deadline"
  | "daysLeft"
  | "stage"
  | "bidding"
  | "createdAt"
  | "referencePrice"
  | "awardedAmount"
  | "goodsCategory"
  | "procurementType"
  | "tags"
>;

/** Where real scores separate: a contract of the company's kind that it qualifies for. */
export const HIGH_MATCH = 70;

const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** The Monday (Bangkok time) that starts the week holding `ms`, as a UTC timestamp. */
export function weekStartOf(ms: number): number {
  const day = Math.floor((ms + BANGKOK_OFFSET_MS) / DAY_MS);
  // 1970-01-01 was a Thursday, so day 0 is three days into a Monday-based week.
  const monday = day - ((day + 3) % 7);
  return monday * DAY_MS - BANGKOK_OFFSET_MS;
}

/** TORs that opened in each of the last `weeks` weeks, oldest first, ending with this week. */
export function newPerWeek(tors: StatTor[], weeks = 8, now = Date.now()): { weekStart: number; count: number }[] {
  const thisWeek = weekStartOf(now);
  const series = Array.from({ length: weeks }, (_, i) => ({
    weekStart: thisWeek - (weeks - 1 - i) * 7 * DAY_MS,
    count: 0,
  }));
  for (const tor of tors) {
    const opened = openedAt(tor);
    if (!opened) continue;
    const index = (weekStartOf(opened) - series[0].weekStart) / (7 * DAY_MS);
    if (index >= 0 && index < weeks) series[index].count += 1;
  }
  return series;
}

/** Match-score bands, best first. `strong` marks the bands at or above the high-match line. */
export const MATCH_BANDS = [
  { id: "excellent", min: 85, max: 100 },
  { id: "good", min: 70, max: 84 },
  { id: "fair", min: 50, max: 69 },
  { id: "low", min: 0, max: 49 },
] as const;

export function matchDistribution(tors: { match: number }[], highMatch = HIGH_MATCH) {
  return MATCH_BANDS.map((band) => ({
    ...band,
    count: tors.filter((tor) => tor.match >= band.min && tor.match <= band.max).length,
    strong: band.min >= highMatch,
  }));
}

/** Open TORs by how soon they close. The first band is the urgent one. */
export const CLOSING_BANDS = [
  { id: "week", min: 0, max: 7 },
  { id: "twoWeeks", min: 8, max: 14 },
  { id: "month", min: 15, max: 30 },
  { id: "later", min: 31, max: Infinity },
] as const;

export function closingSchedule(tors: StatTor[]) {
  const days = tors
    .filter((tor) => biddingOf(tor).status === "open")
    .map((tor) => daysUntilClose(tor))
    .filter((d): d is number => d !== null);
  return CLOSING_BANDS.map((band) => ({
    ...band,
    count: days.filter((d) => d >= band.min && d <= band.max).length,
  }));
}

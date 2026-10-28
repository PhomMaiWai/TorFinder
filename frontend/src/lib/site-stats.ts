import { closingSchedule, newPerWeek, weekStartOf } from "@/lib/dashboard-stats";
import { amountOf, openedAt } from "@/lib/tor-sort";
import { BUDGET_RANGES, biddingOf, daysUntilClose, isClosingSoon } from "@/lib/tor-ui";
import { TOR_STAGES, type TorRecord, type TorStage } from "@/types/tor";

/**
 * The public overview's numbers, computed on the server from every TOR in the
 * database and shipped to the page as a small summary — never the records.
 *
 * Money is counted per *project*, not per announcement: e-GP prints a plan, a
 * draft, a TOR and an award notice for the same project, and adding each one's
 * amount would count the project four times. A project is its e-GP project
 * number, or the record itself when it has none.
 */

const TOP_METHODS = 5;
const LIST_SIZE = 5;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Six weeks of closing dates, starting with this week's Monday. */
const CALENDAR_DAYS = 42;

type Project = {
  key: string;
  agency: string;
  value: number | null;
  stage: TorStage;
  method: string | null;
  /** When the project first appeared: its earliest announcement. */
  opened: number;
  referencePrice: number | null;
  awardedAmount: number | null;
};

export type ListedTor = { id: string; title: string; agency: string; amount: number | null; days: number | null };

export type SiteOverview = {
  updatedAt: string | null;
  announcements: number;
  projects: number;
  agencyCount: number;
  totalValue: number;
  valuedProjects: number;
  openNow: number;
  closingThisWeek: number;
  weekly: { weekStart: number; count: number }[];
  /** Projects at each stage of the procurement lifecycle, in lifecycle order. */
  stages: { stage: TorStage; count: number }[];
  /** Projects per size band (see BUDGET_RANGES). */
  sizes: { id: (typeof BUDGET_RANGES)[number]["id"]; count: number }[];
  /** e-GP's procurement method, largest first; `null` folds the tail and the unknown. */
  methods: { method: string | null; count: number }[];
  /** Every agency, most announcements first, with the value of its projects. */
  agencies: { agency: string; announcements: number; value: number }[];
  closing: ReturnType<typeof closingSchedule>;
  closingSoon: ListedTor[];
  largest: ListedTor[];
  /** Announcements by whether they take bids right now. */
  status: { open: number; closed: number; unknown: number };
  /** Total project value known by the end of each of the last 12 weeks. */
  cumulative: { weekStart: number; total: number }[];
  /** Every open TOR with both a known amount and a closing date. */
  scatter: ListedTor[];
  /** Open TORs closing on each day, from this week's Monday (Bangkok). */
  calendar: { start: number; today: number; counts: number[] };
  /** How many announcements carry each fact a bidder needs. */
  transparency: { total: number; referencePrice: number; deadline: number; documents: number };
  /** Projects with both a reference price and an award: how far under the price they were won. */
  savings: { projects: number; referenceTotal: number; awardedTotal: number };
};

const stageIndex = (stage: TorStage | undefined) => (stage ? TOR_STAGES.indexOf(stage) : -1);

function projectKey(tor: TorRecord): string {
  return tor.projectNumber ? `p:${tor.projectNumber}` : `r:${tor.id}`;
}

/** One row per project: its furthest stage, and the largest amount any of its announcements states. */
function toProjects(tors: TorRecord[]): Project[] {
  const projects = new Map<string, Project>();
  for (const tor of tors) {
    const key = projectKey(tor);
    const stage = tor.currentStage ?? tor.stage;
    const amount = amountOf(tor);
    const opened = openedAt(tor);
    const known = projects.get(key);
    if (!known) {
      projects.set(key, {
        key,
        agency: tor.agency,
        value: amount,
        stage,
        method: tor.procurementMethod || null,
        opened,
        referencePrice: tor.referencePrice ?? null,
        awardedAmount: tor.awardedAmount ?? null,
      });
      continue;
    }
    if (amount !== null && (known.value === null || amount > known.value)) known.value = amount;
    if (stageIndex(stage) > stageIndex(known.stage)) known.stage = stage;
    known.method ??= tor.procurementMethod || null;
    if (opened && (!known.opened || opened < known.opened)) known.opened = opened;
    known.referencePrice = Math.max(known.referencePrice ?? 0, tor.referencePrice ?? 0) || null;
    known.awardedAmount = Math.max(known.awardedAmount ?? 0, tor.awardedAmount ?? 0) || null;
  }
  return [...projects.values()];
}

function listed(tor: TorRecord): ListedTor {
  return { id: tor.id, title: tor.title, agency: tor.agency, amount: amountOf(tor), days: daysUntilClose(tor) };
}

function latest(tors: TorRecord[]): string | null {
  let best = 0;
  for (const tor of tors) {
    for (const stamp of [tor.enrichedAt, tor.importedAt, tor.createdAt]) {
      const time = stamp ? Date.parse(stamp) : NaN;
      if (!Number.isNaN(time) && time > best) best = time;
    }
  }
  return best ? new Date(best).toISOString() : null;
}

export function buildSiteOverview(tors: TorRecord[], now = Date.now()): SiteOverview {
  const projects = toProjects(tors);
  const valued = projects.filter((p): p is Project & { value: number } => p.value !== null && p.value > 0);
  const totalValue = valued.reduce((sum, p) => sum + p.value, 0);

  const agencyRows = new Map<string, { agency: string; announcements: number; value: number }>();
  for (const tor of tors) {
    const row = agencyRows.get(tor.agency) ?? { agency: tor.agency, announcements: 0, value: 0 };
    row.announcements += 1;
    agencyRows.set(tor.agency, row);
  }
  for (const project of valued) {
    const row = agencyRows.get(project.agency);
    if (row) row.value += project.value;
  }

  const methodCounts = new Map<string, number>();
  let unknownMethod = 0;
  for (const project of projects) {
    if (project.method) methodCounts.set(project.method, (methodCounts.get(project.method) ?? 0) + 1);
    else unknownMethod += 1;
  }
  const methodsSorted = [...methodCounts.entries()].sort((a, b) => b[1] - a[1]);
  const methods: SiteOverview["methods"] = methodsSorted
    .slice(0, TOP_METHODS)
    .map(([method, count]) => ({ method, count }));
  const methodRest = methodsSorted.slice(TOP_METHODS).reduce((sum, [, count]) => sum + count, 0);
  // Only worth a bar when some projects do name a method; otherwise the chart shows its empty state.
  if (methods.length > 0 && methodRest + unknownMethod > 0) methods.push({ method: null, count: methodRest + unknownMethod });

  const open = tors.filter((tor) => biddingOf(tor).status === "open");

  const status = { open: 0, closed: 0, unknown: 0 };
  for (const tor of tors) status[biddingOf(tor).status] += 1;

  // Running total of project value at the end of each week; projects from before the window are the base.
  const firstWeek = weekStartOf(now) - 11 * WEEK_MS;
  const cumulative = Array.from({ length: 12 }, (_, i) => {
    const weekEnd = firstWeek + (i + 1) * WEEK_MS;
    return {
      weekStart: firstWeek + i * WEEK_MS,
      total: valued.filter((p) => p.opened > 0 && p.opened < weekEnd).reduce((sum, p) => sum + p.value, 0),
    };
  });

  const calendarStart = weekStartOf(now);
  const todayIndex = Math.floor((now - calendarStart) / DAY_MS);
  const counts = Array.from({ length: CALENDAR_DAYS }, () => 0);
  for (const tor of open) {
    const days = daysUntilClose(tor);
    const index = days === null ? -1 : todayIndex + days;
    if (index >= 0 && index < CALENDAR_DAYS) counts[index] += 1;
  }

  const priced = projects.filter(
    (p): p is Project & { referencePrice: number; awardedAmount: number } =>
      p.referencePrice !== null && p.awardedAmount !== null,
  );

  return {
    updatedAt: latest(tors),
    announcements: tors.length,
    projects: projects.length,
    agencyCount: agencyRows.size,
    totalValue,
    valuedProjects: valued.length,
    openNow: open.length,
    closingThisWeek: tors.filter(isClosingSoon).length,
    weekly: newPerWeek(tors, 12, now),
    stages: TOR_STAGES.map((stage) => ({ stage, count: projects.filter((p) => p.stage === stage).length })),
    sizes: BUDGET_RANGES.map((range) => ({
      id: range.id,
      count: valued.filter((p) => p.value >= range.min && p.value < range.max).length,
    })),
    methods,
    agencies: [...agencyRows.values()].sort(
      (a, b) => b.announcements - a.announcements || b.value - a.value || a.agency.localeCompare(b.agency, "th"),
    ),
    closing: closingSchedule(tors),
    closingSoon: open
      .map(listed)
      .filter((tor) => tor.days !== null)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .slice(0, LIST_SIZE),
    largest: tors
      .map(listed)
      .filter((tor) => tor.amount !== null)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      // A project's TOR and award notice can share the top: keep the first of each title.
      .filter((tor, i, all) => all.findIndex((other) => other.title === tor.title) === i)
      .slice(0, LIST_SIZE),
    status,
    cumulative,
    scatter: open.map(listed).filter((tor) => tor.amount !== null && tor.days !== null),
    calendar: { start: calendarStart, today: todayIndex, counts },
    transparency: {
      total: tors.length,
      referencePrice: tors.filter((tor) => tor.referencePrice).length,
      deadline: tors.filter((tor) => daysUntilClose(tor) !== null).length,
      documents: tors.filter((tor) => (tor.documents?.length ?? 0) > 0 || tor.sourceUrl).length,
    },
    savings: {
      projects: priced.length,
      referenceTotal: priced.reduce((sum, p) => sum + p.referencePrice, 0),
      awardedTotal: priced.reduce((sum, p) => sum + p.awardedAmount, 0),
    },
  };
}

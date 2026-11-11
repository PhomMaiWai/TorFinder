import { awardedOf, baseOf, BidPeer, Competition, competitionOf, SANE_RATIO } from "../matching/bid-insight";
import { median } from "../matching/budget-analysis";
import { UNKNOWN } from "../tor/tor-normalize";

/** What the insights read from a record; structural so a TorDoc fits as-is. */
export type AwardRecord = Pick<
  BidPeer,
  "projectNumber" | "budgetAmount" | "referencePrice" | "awardedAmount" | "extraction"
> & {
  agency: string;
  createdAt?: Date;
  contracts?: { vendor: string; amount: number | null; signedAt?: Date | null }[];
};

/**
 * How spread the wins at one agency are. Read from who won, not from who bid:
 * no source publishes the losing bids, so "low" means one company keeps
 * winning there, not that it was the only one to try.
 */
export type WinnerSpread = "low" | "medium" | "high";

export type WinnerRow = {
  vendor: string;
  /** Projects this company won. */
  wins: number;
  /** Baht across those projects, where the award amount was published. */
  totalAwarded: number;
  /** Distinct agencies it won at. */
  agencies: number;
};

export type AgencyWinner = {
  vendor: string;
  wins: number;
  /** wins / the agency's projects with a named winner, 0-1 — its share of that agency's awards. */
  share: number;
};

export type AgencyRow = {
  agency: string;
  /** Awarded projects, one per project however many stages were imported. */
  projects: number;
  /** Of those, the ones whose winner is named. */
  withWinner: number;
  distinctWinners: number;
  topWinners: AgencyWinner[];
  totalAwarded: number;
  /** Projects whose award could be set against a reference price or budget. */
  priced: number;
  /** Median of 1 - awarded / base, 0-1; null below MIN_PRICED. */
  medianDiscount: number | null;
  averageDiscount: number | null;
  /** Winner concentration; null below MIN_WINNERS. */
  competition: WinnerSpread | null;
  /** Price pressure, as the per-announcement bid insight reads it; null below MIN_PRICED. */
  priceCompetition: Competition | null;
};

export type MarketInsights = {
  /** The year asked for (Christian era), or null for every year. */
  year: number | null;
  /** Years that hold at least one awarded project, newest first. */
  years: number[];
  summary: {
    projects: number;
    withWinner: number;
    priced: number;
    /** How many priced projects were set against ราคากลาง, and how many fell back to the budget. */
    referenceBased: number;
    budgetBased: number;
    agencies: number;
    distinctWinners: number;
    totalAwarded: number;
    medianDiscount: number | null;
    averageDiscount: number | null;
  };
  topWinners: WinnerRow[];
  agencies: AgencyRow[];
  /** Price-vs-base bands across every priced project, for a distribution chart. */
  discountBands: { band: DiscountBand; projects: number }[];
};

export const DISCOUNT_BANDS = ["<0%", "0-5%", "5-10%", "10-15%", "15-25%", "25%+"] as const;
export type DiscountBand = (typeof DISCOUNT_BANDS)[number];

/** An agency needs this many named winners before its spread means anything. */
export const MIN_WINNERS = 3;
/** And this many priced awards before a median discount does. */
export const MIN_PRICED = 3;
/** One company holding more than this share of an agency's awards: little competition there. */
export const DOMINANT_SHARE = 0.5;
/** Nearly every award going to a different company: a contested agency. */
export const SPREAD_RATIO = 0.75;
const TOP_WINNERS = 10;
const TOP_PER_AGENCY = 3;

/**
 * One company under the spellings agencies type it with: "บริษัท เอ บี ซี จำกัด",
 * "บจก.เอบีซี" and "เอบีซี จำกัด" are one winner. Only the legal-form words
 * and spacing are dropped, so two genuinely different names never merge.
 */
export function vendorKey(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^(บริษัท|บจก\.?|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วนสามัญ|หจก\.?)/, "")
    .replace(/(จำกัด\(มหาชน\)|\(มหาชน\)|จำกัด|co\.?,?ltd\.?|companylimited|limited|ltd\.?|inc\.?)$/, "")
    .replace(/[.,]+$/, "");
}

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

/** The year a project was awarded in, by Bangkok's calendar: the contract date, else the announcement's. */
function yearOf(record: AwardRecord): number | null {
  const date = record.contracts?.find((contract) => contract.signedAt)?.signedAt ?? record.createdAt;
  if (!date) return null;
  return new Date(date.getTime() + 7 * 3_600_000).getUTCFullYear();
}

function bandOf(discount: number): DiscountBand {
  if (discount < 0) return "<0%";
  if (discount < 0.05) return "0-5%";
  if (discount < 0.1) return "5-10%";
  if (discount < 0.15) return "10-15%";
  if (discount < 0.25) return "15-25%";
  return "25%+";
}

/** One awarded project, after its announcement stages are folded together. */
type Project = {
  agency: string;
  year: number | null;
  /** vendorKey → the name as published. */
  vendors: Map<string, string>;
  awarded: number | null;
  base: { value: number; kind: "reference" | "budget" } | null;
};

/**
 * Folds the stages of one project into one: e-GP stores a record per
 * announcement, and only some of them carry the contract or the price. A
 * reference price beats a budget, and the first figure found is kept.
 */
function toProjects(records: AwardRecord[]): Project[] {
  const byNumber = new Map<string, Project>();
  const projects: Project[] = [];

  for (const record of records) {
    const vendors = new Map<string, string>();
    for (const contract of record.contracts ?? []) {
      const name = cleanName(contract.vendor ?? "");
      if (name) vendors.set(vendorKey(name), name);
    }
    const project: Project = {
      agency: cleanName(record.agency ?? "") || UNKNOWN,
      year: yearOf(record),
      vendors,
      awarded: awardedOf({ ...record, title: "", summary: "", tags: [] }),
      base: baseOf({ ...record, title: "", summary: "", tags: [] }),
    };

    const known = record.projectNumber ? byNumber.get(record.projectNumber) : undefined;
    if (!known) {
      if (record.projectNumber) byNumber.set(record.projectNumber, project);
      projects.push(project);
      continue;
    }
    for (const [key, name] of project.vendors) if (!known.vendors.has(key)) known.vendors.set(key, name);
    known.awarded ??= project.awarded;
    known.year ??= project.year;
    if (!known.base || (known.base.kind === "budget" && project.base?.kind === "reference")) {
      known.base = project.base ?? known.base;
    }
    if (known.agency === UNKNOWN) known.agency = project.agency;
  }

  return projects.filter((project) => project.vendors.size > 0 || project.awarded !== null);
}

/** 1 - awarded / base when that is a believable price, else null — see SANE_RATIO. */
function discountOf(project: Project): number | null {
  if (!project.base || !project.awarded) return null;
  const ratio = project.awarded / project.base.value;
  if (ratio < SANE_RATIO.min || ratio > SANE_RATIO.max) return null;
  return 1 - ratio;
}

function discountStats(discounts: number[]) {
  if (discounts.length === 0) return { median: null, average: null };
  const sorted = [...discounts].sort((a, b) => a - b);
  return {
    median: median(sorted),
    average: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function spreadOf(withWinner: number, distinct: number, topWins: number): WinnerSpread | null {
  if (withWinner < MIN_WINNERS) return null;
  if (topWins / withWinner > DOMINANT_SHARE) return "low";
  if (distinct / withWinner >= SPREAD_RATIO) return "high";
  return "medium";
}

/**
 * Who wins Bangkok's software work, for how much against the agency's own
 * price, and where one company keeps winning. Every figure counts published
 * awards only: the sources name the winner and the winning price, never the
 * other bids, so "against the average" here means against the reference
 * price (or the budget where none was published), and a company's "win rate"
 * at an agency is its share of that agency's awards.
 */
export function buildMarketInsights(records: AwardRecord[], year: number | null = null): MarketInsights {
  const all = toProjects(records);
  const years = [...new Set(all.map((project) => project.year).filter((y): y is number => y !== null))].sort(
    (a, b) => b - a,
  );
  const projects = year === null ? all : all.filter((project) => project.year === year);

  const winners = new Map<string, { name: string; wins: number; totalAwarded: number; agencies: Set<string> }>();
  const agencies = new Map<
    string,
    { projects: number; withWinner: number; wins: Map<string, number>; totalAwarded: number; discounts: number[] }
  >();
  const discounts: number[] = [];
  let referenceBased = 0;
  let budgetBased = 0;
  let totalAwarded = 0;

  for (const project of projects) {
    const agency = agencies.get(project.agency) ?? {
      projects: 0,
      withWinner: 0,
      wins: new Map<string, number>(),
      totalAwarded: 0,
      discounts: [],
    };
    agencies.set(project.agency, agency);
    agency.projects += 1;
    agency.totalAwarded += project.awarded ?? 0;
    totalAwarded += project.awarded ?? 0;

    const discount = discountOf(project);
    if (discount !== null) {
      discounts.push(discount);
      agency.discounts.push(discount);
      if (project.base?.kind === "reference") referenceBased += 1;
      else budgetBased += 1;
    }

    if (project.vendors.size > 0) agency.withWinner += 1;
    // A project split into lots can have several winners; the amount is split
    // evenly among them, since the per-lot figures aren't always published.
    const share = project.awarded ? project.awarded / project.vendors.size : 0;
    for (const [key, name] of project.vendors) {
      agency.wins.set(key, (agency.wins.get(key) ?? 0) + 1);
      const winner = winners.get(key) ?? { name, wins: 0, totalAwarded: 0, agencies: new Set<string>() };
      winner.wins += 1;
      winner.totalAwarded += share;
      winner.agencies.add(project.agency);
      winners.set(key, winner);
    }
  }

  const nameOf = (key: string) => winners.get(key)?.name ?? key;
  const byWins = <T extends { wins: number; totalAwarded?: number }>(a: T, b: T) =>
    b.wins - a.wins || (b.totalAwarded ?? 0) - (a.totalAwarded ?? 0);

  const agencyRows: AgencyRow[] = [...agencies.entries()].map(([agency, row]) => {
    const ranked = [...row.wins.entries()]
      .map(([key, wins]) => ({ vendor: nameOf(key), wins, share: row.withWinner ? wins / row.withWinner : 0 }))
      .sort((a, b) => b.wins - a.wins || a.vendor.localeCompare(b.vendor, "th"));
    const stats = discountStats(row.discounts);
    const enoughPrices = row.discounts.length >= MIN_PRICED;
    return {
      agency,
      projects: row.projects,
      withWinner: row.withWinner,
      distinctWinners: row.wins.size,
      topWinners: ranked.slice(0, TOP_PER_AGENCY),
      totalAwarded: Math.round(row.totalAwarded),
      priced: row.discounts.length,
      medianDiscount: enoughPrices ? stats.median : null,
      averageDiscount: enoughPrices ? stats.average : null,
      competition: spreadOf(row.withWinner, row.wins.size, ranked[0]?.wins ?? 0),
      priceCompetition: enoughPrices && stats.median !== null ? competitionOf(stats.median) : null,
    };
  });
  agencyRows.sort((a, b) => b.projects - a.projects || b.totalAwarded - a.totalAwarded);

  const topWinners: WinnerRow[] = [...winners.values()]
    .map((winner) => ({
      vendor: winner.name,
      wins: winner.wins,
      totalAwarded: Math.round(winner.totalAwarded),
      agencies: winner.agencies.size,
    }))
    .sort(byWins)
    .slice(0, TOP_WINNERS);

  const bandCounts = new Map<DiscountBand, number>(DISCOUNT_BANDS.map((band) => [band, 0]));
  for (const discount of discounts) bandCounts.set(bandOf(discount), (bandCounts.get(bandOf(discount)) ?? 0) + 1);

  const overall = discountStats(discounts);
  return {
    year,
    years,
    summary: {
      projects: projects.length,
      withWinner: projects.filter((project) => project.vendors.size > 0).length,
      priced: discounts.length,
      referenceBased,
      budgetBased,
      agencies: agencies.size,
      distinctWinners: winners.size,
      totalAwarded: Math.round(totalAwarded),
      medianDiscount: overall.median,
      averageDiscount: overall.average,
    },
    topWinners,
    agencies: agencyRows,
    discountBands: DISCOUNT_BANDS.map((band) => ({ band, projects: bandCounts.get(band) ?? 0 })),
  };
}

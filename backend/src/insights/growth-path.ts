import type { BiddingStatus } from "../tor/tor-bidding";
import { median } from "../matching/budget-analysis";

import { AwardRecord, MIN_WINNERS, Project, toProjects } from "./market-insights";

/**
 * A growth path for a small company (#261): a new company can't bid on a
 * 10–100 M baht TOR without past work of that size, so instead of the biggest
 * jobs it is shown where to start — agencies that buy jobs its size from few
 * different companies, and the open announcements it can bid on now and one
 * step up. Read from published awards only, like the market insights.
 */

/** What the path reads from the company profile. */
export type GrowthCompany = {
  largestPastContract?: number | null;
  preferredBudgetMax?: number | null;
  /** The proposal library's contracts; public-sector ones count as past work. */
  pastProjects?: { value?: number | null; clientType?: string | null }[];
};

/** Where the size the company can bid at came from, so the page can say it. */
export type CapSource = "pastContract" | "library" | "preferredMax" | "starter";

/**
 * With no past work on record, start at what Thai agencies may buy by the
 * specific method (วิธีเฉพาะเจาะจง): up to 500,000 baht.
 */
export const STARTER_CAP = 500_000;
/** The next step: up to twice the largest job done so far. */
export const NEXT_STEP_FACTOR = 2;
/** One right-sized job is a one-off; this many is a pattern worth recommending. */
export const MIN_RIGHT_SIZED = 2;
const TOP_AGENCIES = 8;
const TOP_JOBS = 8;

export type GrowthAgency = {
  agency: string;
  /** Awarded projects at or under the company's size. */
  rightSized: number;
  /** Median value of those, baht. */
  medianSize: number;
  /** Of those, the ones whose winner is named. */
  withWinner: number;
  /** Distinct companies that won them: the rivals a company this size meets there. */
  rivals: number;
  /** The company that won most of them and its share, 0-1; null when no winner is named. */
  topWinner: { vendor: string; share: number } | null;
  /** Years (Christian era) the agency awarded a job this size, newest first. */
  years: number[];
  /** Companies it hired again in a later year: a sign a first job can continue. */
  rehires: number;
};

/** An open announcement, as the matching dashboard ranks it. */
export type GrowthJobInput = {
  id: string;
  title: string;
  agency: string;
  budgetAmount?: number | null;
  daysLeft?: number | null;
  match: number;
  bidding: { status: BiddingStatus; closesAt: string | null };
};

export type GrowthJob = {
  id: string;
  title: string;
  agency: string;
  budgetAmount: number;
  daysLeft: number | null;
  match: number;
  status: BiddingStatus;
  closesAt: string | null;
  /** At one of the recommended agencies. */
  atRecommendedAgency: boolean;
};

export type GrowthPath = {
  /** The size the company can bid at now, baht, and where that figure came from. */
  cap: number;
  capSource: CapSource;
  /** The top of the next step, baht. */
  nextCap: number;
  agencies: GrowthAgency[];
  jobs: {
    /** Open jobs at or under `cap`. */
    now: GrowthJob[];
    /** Open jobs above `cap`, up to `nextCap`. */
    next: GrowthJob[];
  };
  basis: {
    /** Awarded projects read. */
    projects: number;
    /** Of those, ones with an award amount or a budget to size them by. */
    sized: number;
  };
};

const positive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** The size of job the company has shown it can deliver, else what it asked for, else the starter size. */
export function capOf(company: GrowthCompany): { cap: number; capSource: CapSource } {
  if (positive(company.largestPastContract)) return { cap: company.largestPastContract, capSource: "pastContract" };
  const library = (company.pastProjects ?? [])
    .filter((project) => project.clientType === "government" || project.clientType === "stateEnterprise")
    .map((project) => project.value)
    .filter(positive);
  if (library.length > 0) return { cap: Math.max(...library), capSource: "library" };
  if (positive(company.preferredBudgetMax)) return { cap: company.preferredBudgetMax, capSource: "preferredMax" };
  return { cap: STARTER_CAP, capSource: "starter" };
}

/** What the project was worth: the award, else the price it was set against. */
const sizeOf = (project: Project): number | null => project.awarded ?? project.base?.value ?? null;

function agencyRow(agency: string, projects: Project[]): GrowthAgency {
  const wins = new Map<string, { name: string; wins: number; years: Set<number> }>();
  let withWinner = 0;
  for (const project of projects) {
    if (project.vendors.size > 0) withWinner += 1;
    for (const [key, name] of project.vendors) {
      const row = wins.get(key) ?? { name, wins: 0, years: new Set<number>() };
      row.wins += 1;
      if (project.year !== null) row.years.add(project.year);
      wins.set(key, row);
    }
  }
  const top = [...wins.values()].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, "th"))[0];
  const sizes = projects.map((project) => sizeOf(project) ?? 0).sort((a, b) => a - b);
  const years = [...new Set(projects.map((project) => project.year).filter((y): y is number => y !== null))];

  return {
    agency,
    rightSized: projects.length,
    medianSize: Math.round(median(sizes)),
    withWinner,
    rivals: wins.size,
    topWinner: top && withWinner > 0 ? { vendor: top.name, share: top.wins / withWinner } : null,
    years: years.sort((a, b) => b - a),
    rehires: [...wins.values()].filter((row) => row.years.size >= 2).length,
  };
}

/**
 * Most jobs this size per winning company first — the client's "departments
 * with little competition", weighed by how much the agency buys, so two jobs
 * won by one company don't outrank five shared by two. Then fewer rivals,
 * then more years of buying. An agency whose winners are never named can't be
 * judged for rivals, so it goes after the ones that can.
 */
function byOpportunity(a: GrowthAgency, b: GrowthAgency): number {
  const known = (row: GrowthAgency) => Number(row.withWinner >= Math.min(MIN_WINNERS, row.rightSized));
  const perRival = (row: GrowthAgency) => row.withWinner / Math.max(row.rivals, 1);
  return (
    known(b) - known(a) ||
    perRival(b) - perRival(a) ||
    a.rivals - b.rivals ||
    b.rightSized - a.rightSized ||
    b.years.length - a.years.length ||
    a.agency.localeCompare(b.agency, "th")
  );
}

function toJob(job: GrowthJobInput, recommended: Set<string>): GrowthJob {
  return {
    id: job.id,
    title: job.title,
    agency: job.agency,
    budgetAmount: job.budgetAmount ?? 0,
    daysLeft: job.daysLeft ?? null,
    match: job.match,
    status: job.bidding.status,
    closesAt: job.bidding.closesAt,
    atRecommendedAgency: recommended.has(job.agency),
  };
}

const byRecommendedThenMatch = (a: GrowthJob, b: GrowthJob) =>
  Number(b.atRecommendedAgency) - Number(a.atRecommendedAgency) ||
  Number(b.status === "open") - Number(a.status === "open") ||
  b.match - a.match;

export function buildGrowthPath(company: GrowthCompany, awards: AwardRecord[], openJobs: GrowthJobInput[]): GrowthPath {
  const { cap, capSource } = capOf(company);
  const nextCap = cap * NEXT_STEP_FACTOR;
  const projects = toProjects(awards);
  const sized = projects.filter((project) => sizeOf(project) !== null);

  const byAgency = new Map<string, Project[]>();
  for (const project of sized) {
    if ((sizeOf(project) ?? Infinity) > cap) continue;
    const list = byAgency.get(project.agency) ?? [];
    list.push(project);
    byAgency.set(project.agency, list);
  }

  const agencies = [...byAgency.entries()]
    .filter(([, list]) => list.length >= MIN_RIGHT_SIZED)
    .map(([agency, list]) => agencyRow(agency, list))
    .sort(byOpportunity)
    .slice(0, TOP_AGENCIES);
  const recommended = new Set(agencies.map((row) => row.agency));

  const priced = openJobs.filter((job) => job.bidding.status !== "closed" && positive(job.budgetAmount));
  const now = priced
    .filter((job) => (job.budgetAmount ?? 0) <= cap)
    .map((job) => toJob(job, recommended))
    .sort(byRecommendedThenMatch)
    .slice(0, TOP_JOBS);
  const next = priced
    .filter((job) => (job.budgetAmount ?? 0) > cap && (job.budgetAmount ?? 0) <= nextCap)
    .map((job) => toJob(job, recommended))
    .sort(byRecommendedThenMatch)
    .slice(0, TOP_JOBS);

  return {
    cap,
    capSource,
    nextCap,
    agencies,
    jobs: { now, next },
    basis: { projects: projects.length, sized: sized.length },
  };
}

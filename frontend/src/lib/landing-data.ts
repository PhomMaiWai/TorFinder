import { getAllTors } from "@/lib/tor-source";
import type { TorRecord } from "@/types/tor";

/** The figures the landing page states about the data, all counted from the database. */
export type LandingStats = {
  /** Distinct projects first announced in the last twelve months. */
  projectsPerYear: number;
  /** Distinct agencies among those projects. */
  agenciesPerYear: number;
  /** Their budgets added up, in baht; each project counted once. */
  budgetPerYear: number;
};

/** What a preview card shows — only fields every real record has. */
export type PreviewTor = Pick<TorRecord, "id" | "title" | "agency" | "budget" | "stage" | "daysLeft" | "summary" | "tags">;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** Enough for the preview's search to find something without shipping the whole listing to the browser. */
const PREVIEW_POOL = 60;

/**
 * A project shows up once per announcement stage (draft, invitation, award…),
 * so counting records would count one project several times. The e-GP project
 * number identifies it; a record without one stands alone.
 */
const projectKey = (tor: TorRecord) => tor.projectNumber ?? tor.id;

export async function getLandingData(): Promise<{ stats: LandingStats | null; previews: PreviewTor[] }> {
  let tors: TorRecord[];
  try {
    tors = await getAllTors();
  } catch {
    // The landing page must still render when the backend is down; it just says nothing about the data.
    return { stats: null, previews: [] };
  }

  const since = Date.now() - YEAR_MS;
  const projects = new Map<string, { agency: string; budget: number }>();
  for (const tor of tors) {
    if (!tor.createdAt || Date.parse(tor.createdAt) < since) continue;
    const key = projectKey(tor);
    const budget = tor.budgetAmount ?? 0;
    const known = projects.get(key);
    // Stages can state slightly different figures; the largest is the project's budget.
    if (!known || budget > known.budget) projects.set(key, { agency: tor.agency, budget });
  }

  const stats: LandingStats | null =
    projects.size === 0
      ? null
      : {
          projectsPerYear: projects.size,
          agenciesPerYear: new Set([...projects.values()].map((project) => project.agency)).size,
          budgetPerYear: [...projects.values()].reduce((sum, project) => sum + project.budget, 0),
        };

  // Still open for bids or comment, newest first; one card per project.
  const seen = new Set<string>();
  const previews = tors
    .filter((tor) => tor.bidding?.status === "open")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((tor) => {
      const key = projectKey(tor);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, PREVIEW_POOL)
    .map(({ id, title, agency, budget, stage, daysLeft, summary, tags }) => ({
      id,
      title,
      agency,
      budget,
      stage,
      daysLeft,
      summary,
      tags,
    }));

  return { stats, previews };
}

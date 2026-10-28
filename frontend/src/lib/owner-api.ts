import { fetchJson } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";

/** Comments on one announcement by moderation status. Mirrors the backend's OwnerService. */
export type FeedbackCounts = { approved: number; pending: number; rejected: number };

/** One of the owner's own announcements, as GET /api/owner/tors lists it. */
export type OwnTor = {
  id: string;
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  stage: string;
  createdAt: string;
  /** Approved companies whose score clears their own alert threshold. */
  matchCount: number;
  topScore: number | null;
  feedback: FeedbackCounts;
};

export type OwnTors = {
  totals: { tors: number; matches: number; feedback: FeedbackCounts };
  tors: OwnTor[];
};

/**
 * The signed-in owner's announcements — only those an admin linked to this
 * account. A backend that can't answer throws, so the page shows its error
 * state rather than an owner reading "no projects" off a broken request.
 */
export async function fetchOwnTors(): Promise<OwnTors> {
  return fetchJson<OwnTors>("/api/owner/tors", { headers: await authHeaders() });
}

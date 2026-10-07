import { BackendError, fetchJson } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";
import type { Certification, ScoredTor, WorkType } from "@/types/tor";

/** The profile fields the dashboard shows and judges completeness by. */
export type CompanySummary = {
  companyName?: string;
  workTypes?: WorkType[];
  largestPastContract?: number;
  registeredCapital?: number;
  certifications?: Certification[];
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
};

export type DashboardData = {
  company: CompanySummary | null;
  /** Null when there is no profile to match against yet — not the same as no matches. */
  opportunities: ScoredTor[] | null;
};

/**
 * The signed-in company's profile and the open announcements ranked for it.
 * The backend reads the company from the session, so nothing about it travels
 * in the request. A 404 is an answer — no account or no profile yet — and the
 * dashboard turns it into a call to fill one in rather than an error page.
 */
export async function fetchDashboard(): Promise<DashboardData> {
  const headers = await authHeaders();
  const [account, opportunities] = await Promise.all([
    fetchJson<{ company?: CompanySummary }>("/api/accounts/me", { headers }).catch(answeredWith(null)),
    fetchJson<ScoredTor[]>("/api/matching/opportunities", { headers }).catch(answeredWith(null)),
  ]);
  return { company: account?.company ?? null, opportunities };
}

/** Turns "the backend said no" into a value; anything else still throws. */
function answeredWith<T>(value: T) {
  return (error: unknown): T => {
    if (error instanceof BackendError && error.isAnswer) return value;
    throw error;
  };
}

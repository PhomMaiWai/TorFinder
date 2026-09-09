import type { BudgetAssessment, MatchedCompany, TorFeedback, TorRecord } from "@/types/tor";

/** `source` omitted lists both admin-entered and e-GP records. */
export async function fetchTorList(
  page = 1,
  pageSize = 20,
  source?: "manual" | "egp",
): Promise<TorRecord[]> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (source) query.set("source", source);

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor?${query}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTor(id: string): Promise<TorRecord | null> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/**
 * The budget verdict is computed per request against the whole corpus, so it
 * stays current as announcements are imported. A failure here must not take the
 * page down — the announcement itself is still worth reading.
 */
export async function fetchBudgetAssessment(id: string): Promise<BudgetAssessment | null> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/matching/tor/${id}/budget`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Approved organizations ranked against this announcement. */
export async function fetchMatchedCompanies(id: string): Promise<MatchedCompany[]> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/matching/tor/${id}/companies`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

/** Comments a moderator has published on one announcement. */
export async function fetchFeedback(torId: string): Promise<TorFeedback[]> {
  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${torId}/feedback`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

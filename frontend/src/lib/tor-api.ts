import { fetchJson, orEmptyWhenAnswered, orFallback } from "@/lib/fetch-json";
import type {
  BudgetAssessment,
  MatchedCompany,
  TorFeedback,
  TorRecord,
  TorSource,
} from "@/types/tor";

/**
 * `source` omitted lists every record, whoever entered or imported it.
 *
 * Throws when the backend can't answer: an unreachable backend must not read as
 * "there are no announcements", which is what a listing full of nothing says.
 */
export async function fetchTorList(
  page = 1,
  pageSize = 20,
  source?: TorSource,
): Promise<TorRecord[]> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (source) query.set("source", source);

  return fetchJson<TorRecord[]>(`/api/tor?${query}`);
}

/**
 * One announcement, or null when there genuinely isn't one — which is what the
 * detail page turns into its 404. A backend that is down throws instead, so the
 * reader is told the site is broken rather than that the announcement they
 * followed a link to never existed.
 */
export function fetchTor(id: string): Promise<TorRecord | null> {
  return orEmptyWhenAnswered<TorRecord | null>(fetchJson<TorRecord>(`/api/tor/${id}`), null);
}

/**
 * The budget verdict is computed per request against the whole corpus, so it
 * stays current as announcements are imported. A failure here must not take the
 * page down — the announcement itself is still worth reading.
 */
export function fetchBudgetAssessment(id: string): Promise<BudgetAssessment | null> {
  return orFallback<BudgetAssessment | null>(
    fetchJson<BudgetAssessment>(`/api/matching/tor/${id}/budget`),
    null,
  );
}

/** Approved organizations ranked against this announcement — supplementary. */
export function fetchMatchedCompanies(id: string): Promise<MatchedCompany[]> {
  return orFallback<MatchedCompany[]>(
    fetchJson<MatchedCompany[]>(`/api/matching/tor/${id}/companies`),
    [],
  );
}

/** Comments a moderator has published on one announcement — supplementary. */
export function fetchFeedback(torId: string): Promise<TorFeedback[]> {
  return orFallback<TorFeedback[]>(fetchJson<TorFeedback[]>(`/api/tor/${torId}/feedback`), []);
}

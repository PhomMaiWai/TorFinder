import { fetchJson, orEmptyWhenAnswered } from "@/lib/fetch-json";
import { authHeaders } from "@/lib/session-headers";
import type { GrowthPath, MarketInsights } from "@/types/insights";

/**
 * Market insights over every published award (FR-24). Throws when the backend
 * can't answer, so the page shows its error state instead of an empty market.
 */
export function fetchMarketInsights(year: number | null): Promise<MarketInsights> {
  const query = year === null ? "" : `?year=${year}`;
  return fetchJson<MarketInsights>(`/api/insights/market${query}`);
}

/** `?year=` as the backend takes it: a Christian-era year, or nothing. */
export function parseYearParam(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

/**
 * The signed-in company's growth path (#261). Null when the backend answers
 * that there is no company profile yet, so the page can ask for one; a
 * backend that can't answer still throws.
 */
export async function fetchGrowthPath(): Promise<GrowthPath | null> {
  const headers = await authHeaders();
  return orEmptyWhenAnswered(fetchJson<GrowthPath>("/api/insights/growth", { headers }), null);
}

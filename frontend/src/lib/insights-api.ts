import { fetchJson } from "@/lib/fetch-json";
import type { MarketInsights } from "@/types/insights";

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

/** GET /api/insights/market — see backend/src/insights/market-insights.ts. */

export type WinnerSpread = "low" | "medium" | "high";
export type PriceCompetition = "blue" | "moderate" | "red";

export type MarketWinner = {
  vendor: string;
  wins: number;
  totalAwarded: number;
  agencies: number;
};

export type AgencyInsight = {
  agency: string;
  projects: number;
  withWinner: number;
  distinctWinners: number;
  topWinners: { vendor: string; wins: number; share: number }[];
  totalAwarded: number;
  priced: number;
  medianDiscount: number | null;
  averageDiscount: number | null;
  competition: WinnerSpread | null;
  priceCompetition: PriceCompetition | null;
};

export type MarketInsights = {
  year: number | null;
  years: number[];
  summary: {
    projects: number;
    withWinner: number;
    priced: number;
    referenceBased: number;
    budgetBased: number;
    agencies: number;
    distinctWinners: number;
    totalAwarded: number;
    medianDiscount: number | null;
    averageDiscount: number | null;
  };
  topWinners: MarketWinner[];
  agencies: AgencyInsight[];
  discountBands: { band: string; projects: number }[];
};

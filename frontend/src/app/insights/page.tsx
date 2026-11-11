import { cookies } from "next/headers";

import { MarketInsightsView } from "@/components/insights/market-insights";
import { AppShell } from "@/components/layout/app-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { fetchMarketInsights, parseYearParam } from "@/lib/insights-api";

/**
 * Who wins Bangkok's software work, at what price against the reference
 * price, and where one company keeps winning (FR-24, #256). Public, like the
 * overview: every figure is read from a published award notice.
 */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams;
  const [insights, session] = await Promise.all([
    fetchMarketInsights(parseYearParam(yearParam)),
    cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value)),
  ]);

  // Same split as /dashboard: companies see it inside their workspace sidebar.
  const workspace = session?.role === "org" || session?.role === "owner";
  const body = <MarketInsightsView data={insights} />;

  if (workspace) {
    return (
      <AppShell>
        <main className="aurora flex min-h-screen flex-col bg-surface-alt/50">{body}</main>
      </AppShell>
    );
  }

  return (
    <>
      <SiteNavbar />
      <main className="aurora min-h-screen bg-surface-alt/40">{body}</main>
      <SiteFooter />
    </>
  );
}

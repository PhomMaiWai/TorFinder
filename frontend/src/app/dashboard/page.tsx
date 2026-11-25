import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { type Audience, Overview, OverviewEmpty } from "@/components/overview/overview";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { buildSiteOverview } from "@/lib/site-stats";
import { getAllTors } from "@/lib/tor-source";

/**
 * The public overview of the whole site — open to guests, and home for every
 * signed-in account but admins (see homeFor). Everyone lands on it with the
 * public navbar, companies too; `?in=app` is the company workspace's view of
 * it, inside the sidebar (see workspaceFor).
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ in?: string }> }) {
  const [tors, session, { in: context }] = await Promise.all([
    getAllTors(),
    cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value)),
    searchParams,
  ]);

  // Only company accounts have the workspace sidebar: its menu is the company's
  // (profile, matches). Admins have their own console, and a viewer has none.
  const audience: Audience = !session
    ? "guest"
    : session.role === "org" && context === "app"
      ? "workspace"
      : "viewer";
  // Only the summary crosses to the client, never the records themselves.
  const body =
    tors.length === 0 ? (
      <OverviewEmpty />
    ) : (
      <Overview data={buildSiteOverview(tors)} audience={audience} matchesLink={session?.role === "org"} />
    );

  if (audience === "workspace") {
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

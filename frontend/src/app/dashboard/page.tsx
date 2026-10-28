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
 * signed-in account but admins (see homeFor). Companies see it inside their
 * workspace sidebar; everyone else gets the public navbar.
 */
export default async function DashboardPage() {
  const [tors, session] = await Promise.all([
    getAllTors(),
    cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value)),
  ]);

  const audience: Audience = !session
    ? "guest"
    : session.role === "viewer" || session.role === "admin"
      ? "viewer"
      : "workspace";
  // Only the summary crosses to the client, never the records themselves.
  const body = tors.length === 0 ? <OverviewEmpty /> : <Overview data={buildSiteOverview(tors)} audience={audience} />;

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

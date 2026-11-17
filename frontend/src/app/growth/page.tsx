import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GrowthPathView } from "@/components/insights/growth-path";
import { AppShell } from "@/components/layout/app-sidebar";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { fetchGrowthPath } from "@/lib/insights-api";
import { homeFor } from "@/lib/roles";

/**
 * Where a small company can start (#261): agencies that buy jobs its size
 * from few companies, and the open jobs at its size and one step up. Company
 * accounts only — it reads the company's own profile.
 */
export default async function GrowthPage() {
  const session = await cookies().then((jar) => verifySessionToken(jar.get(SESSION_COOKIE)?.value));
  if (!session) redirect("/login?next=/growth");
  if (session.role !== "org") redirect(homeFor(session.role));

  const path = await fetchGrowthPath();
  return (
    <AppShell>
      <main className="aurora flex min-h-screen flex-col bg-surface-alt/50">
        <GrowthPathView data={path} />
      </main>
    </AppShell>
  );
}

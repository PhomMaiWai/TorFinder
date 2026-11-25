import { useTranslations } from "next-intl";

import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import type { LandingStats } from "@/lib/landing-data";

/** Hours between e-GP imports: the backend's EGP_POLL_MINUTES default (360). */
const EGP_POLL_HOURS = 6;

const millions = (baht: number) => Math.round(baht / 1_000_000).toLocaleString("en-US");

/**
 * What the database actually holds, counted when the page is built (see
 * getLandingData) — not figures typed into the copy. Without a backend to ask,
 * the bar isn't shown at all rather than showing guesses.
 */
export function StatsBar({ stats }: { stats: LandingStats | null }) {
  const t = useTranslations("LandingStats");
  if (!stats) return null;

  const items = [
    { value: stats.projectsPerYear.toLocaleString("en-US"), label: t("projects") },
    { value: stats.agenciesPerYear.toLocaleString("en-US"), label: t("agencies") },
    { value: t("budgetValue", { amount: millions(stats.budgetPerYear) }), label: t("budget") },
    { value: t("pollValue", { hours: EGP_POLL_HOURS }), label: t("poll") },
  ];

  return (
    <section className="bg-surface px-6 pb-4">
      <Reveal className="glass mx-auto max-w-5xl rounded-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          {items.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="bg-gradient-to-b from-ink to-ink-muted bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                <CountUp value={stat.value} />
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-border/60 px-4 py-2.5 text-center text-xs text-ink-subtle">{t("footnote")}</p>
      </Reveal>
    </section>
  );
}

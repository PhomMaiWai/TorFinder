import { useTranslations } from "next-intl";

import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";

type Stat = { value: string; label: string };

export function StatsBar() {
  const t = useTranslations("LandingStats");
  const STATS = t.raw("items") as Stat[];

  return (
    <section className="bg-surface px-6 pb-4">
      <Reveal className="glass mx-auto max-w-5xl rounded-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="bg-gradient-to-b from-ink to-ink-muted bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                <CountUp value={stat.value} />
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

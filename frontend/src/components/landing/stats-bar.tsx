import { useTranslations } from "next-intl";

type Stat = { value: string; label: string };

export function StatsBar() {
  const t = useTranslations("LandingStats");
  const STATS = t.raw("items") as Stat[];

  return (
    <section className="border-y border-border bg-surface-alt">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-ink">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { AlarmClock, Bookmark, CalendarClock, FolderOpen, Gauge, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";

import { ChartCard, EmphasisColumns, Meter, Sparkline } from "@/components/dashboard/charts";
import { CountUp } from "@/components/ui/count-up";
import { closingSchedule, HIGH_MATCH, matchDistribution, newPerWeek } from "@/lib/dashboard-stats";
import { biddingOf, isClosingSoon } from "@/lib/tor-ui";
import type { ScoredTor } from "@/types/tor";

const CLOSING_LABEL = {
  week: "closingWeek",
  twoWeeks: "closingTwoWeeks",
  month: "closingMonth",
  later: "closingLater",
} as const;

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  visual,
  delay,
}: {
  icon: ComponentType<{ size?: number }>;
  tone: string;
  label: string;
  value: number;
  hint: ReactNode;
  visual?: ReactNode;
  delay: number;
}) {
  return (
    <div
      className="glass animate-fade-up group flex flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgb(225_29_72/30%)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone} transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={16} />
        </span>
        <dt className="min-w-0 truncate text-sm font-medium text-ink-muted">{label}</dt>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <dd className="text-3xl font-bold leading-none tracking-tight text-ink">
          <CountUp value={value} duration={900} />
        </dd>
        {visual}
      </div>
      <p className="mt-2.5 text-xs text-ink-subtle">{hint}</p>
    </div>
  );
}

/** The four headline numbers, each with the small picture that explains it. */
export function KpiRow({ list, savedCount }: { list: ScoredTor[]; savedCount: number }) {
  const t = useTranslations("Dashboard");
  const weekly = newPerWeek(list).map((week) => week.count);
  const open = list.filter((tor) => biddingOf(tor).status === "open").length;
  const eligible = list.filter((tor) => tor.eligible === true).length;
  const urgent = list.filter(isClosingSoon).length;

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={FolderOpen}
        tone="bg-accent-soft text-accent"
        label={t("statOpen")}
        value={open}
        visual={<Sparkline values={weekly} />}
        hint={t("kpiNewThisWeek", { count: weekly.at(-1) ?? 0 })}
        delay={60}
      />
      <KpiTile
        icon={ShieldCheck}
        tone="bg-success-soft text-success"
        label={t("statEligible")}
        value={eligible}
        visual={
          <div className="w-24 pb-1">
            <Meter value={eligible} total={list.length} />
          </div>
        }
        hint={t("kpiOfTotal", { total: list.length })}
        delay={120}
      />
      <KpiTile
        icon={AlarmClock}
        tone="bg-danger-soft text-danger"
        label={t("statUrgent")}
        value={urgent}
        visual={
          <div className="w-24 pb-1">
            <Meter value={urgent} total={open} />
          </div>
        }
        hint={t("kpiWithinWeek")}
        delay={180}
      />
      <KpiTile
        icon={Bookmark}
        tone="bg-surface-alt text-ink"
        label={t("statSaved")}
        value={savedCount}
        hint={
          <Link href="/saved" className="font-medium text-accent transition-colors hover:text-accent-dark">
            {t("kpiSavedHint")} →
          </Link>
        }
        delay={240}
      />
    </dl>
  );
}

/** Charts about this company's own matches; the market-wide view lives on /dashboard. */
export function DashboardInsights({ list }: { list: ScoredTor[] }) {
  const t = useTranslations("Dashboard");
  const tors = (count: number) => t("torCount", { count });

  const match = matchDistribution(list, HIGH_MATCH).map((band) => {
    const label = band.min === 0 ? `< ${band.max + 1}` : `${band.min}–${band.max}`;
    return { label, tip: `Match ${label}`, value: band.count, emphasis: band.strong };
  });

  const closing = closingSchedule(list).map((band) => {
    const label = t(CLOSING_LABEL[band.id]);
    return { label, tip: label, value: band.count, emphasis: band.id === "week" };
  });

  return (
    <section aria-labelledby="insights-title" className="mb-8">
      <div className="mb-4">
        <h2 id="insights-title" className="text-lg font-bold tracking-tight text-ink">
          {t("insightsTitle")}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("insightsDescription")}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title={t("chartMatchTitle")}
          subtitle={t("chartMatchSubtitle")}
          icon={<Gauge size={17} />}
          table={{
            head: [t("tableBand"), t("tableCount")],
            rows: list.length === 0 ? [] : match.map((band) => [band.label, String(band.value)]),
          }}
          delay={100}
        >
          <EmphasisColumns data={match} format={tors} />
        </ChartCard>

        <ChartCard
          title={t("chartClosingTitle")}
          subtitle={t("chartClosingSubtitle")}
          icon={<CalendarClock size={17} />}
          table={{
            head: [t("tableBand"), t("tableCount")],
            rows: closing.every((band) => band.value === 0) ? [] : closing.map((band) => [band.label, String(band.value)]),
          }}
          delay={160}
        >
          <EmphasisColumns data={closing} format={tors} />
        </ChartCard>
      </div>
    </section>
  );
}

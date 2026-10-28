"use client";

import {
  ArrowRight,
  CalendarDays,
  Crosshair,
  PieChart as PieIcon,
  ShieldCheck,
  SquareStack,
  TrendingUp,
  BadgePercent,
  Building2,
  CalendarClock,
  FileStack,
  Gavel,
  Layers,
  LineChart,
  Ruler,
  Search,
  Sparkles,
  Timer,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ComponentType, type ReactNode, useMemo, useState } from "react";

import { ChartCard, EmphasisColumns, Meter, RankedBars, TrendChart, useBahtCompact } from "@/components/dashboard/charts";
import { ClosingCalendar, DonutChart, RingGauges, ValueLine, ValueScatter, ValueTreemap } from "@/components/overview/charts-extra";
import { CountUp } from "@/components/ui/count-up";
import type { ListedTor, SiteOverview } from "@/lib/site-stats";
import { BUDGET_RANGES } from "@/lib/tor-ui";

/** Who is looking decides the calls to action, not what they can see. */
export type Audience = "guest" | "viewer" | "workspace";

const SIZE_AXIS = ["<500K", "0.5–1M", "1–3M", "3–5M", "5–10M", "10M+"];
const CLOSING_LABEL = {
  week: "≤ 7",
  twoWeeks: "8–14",
  month: "15–30",
  later: "> 30",
} as const;

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  visual,
  delay,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string | number;
  hint: string;
  visual?: ReactNode;
  delay: number;
}) {
  return (
    <div
      className="glass animate-fade-up group flex flex-col rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgb(225_29_72/30%)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
          <Icon size={17} />
        </span>
        <dt className="min-w-0 text-sm font-medium text-ink-muted">{label}</dt>
      </div>
      <dd className="mt-4 text-3xl font-bold leading-none tracking-tight text-ink">
        <CountUp value={value} duration={1000} />
      </dd>
      {visual && <div className="mt-3">{visual}</div>}
      <p className="mt-2.5 text-xs text-ink-subtle">{hint}</p>
    </div>
  );
}

function TorList({
  title,
  icon,
  items,
  meta,
  delay,
}: {
  title: string;
  icon: ReactNode;
  items: ListedTor[];
  meta: (tor: ListedTor) => ReactNode;
  delay: number;
}) {
  const t = useTranslations("Overview");
  return (
    <section aria-label={title} className="glass animate-fade-up flex flex-col rounded-2xl p-5" style={{ animationDelay: `${delay}ms` }}>
      <header className="mb-3 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
        <h3 className="flex-1 text-sm font-semibold text-ink">{title}</h3>
        <Link href="/public" className="text-xs font-medium text-accent hover:text-accent-dark">
          {t("viewAll")}
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-subtle">{t("listEmpty")}</p>
      ) : (
        <ol className="divide-y divide-border/50">
          {items.map((tor, i) => (
            <li key={tor.id}>
              <Link
                href={`/tor/${tor.id}`}
                className="group flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-surface-alt/60"
              >
                <span className="w-5 shrink-0 text-center text-xs font-bold text-ink-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {tor.title}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{tor.agency}</span>
                </span>
                <span className="shrink-0 text-right text-xs font-semibold text-ink">{meta(tor)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const AGENCY_PREVIEW = 8;

/** Every agency, filterable — the page's answer to "who is buying?". */
function AgencyTable({ rows, delay }: { rows: SiteOverview["agencies"]; delay: number }) {
  const t = useTranslations("Overview");
  const baht = useBahtCompact();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(1, ...rows.map((row) => row.announcements));

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.agency.toLowerCase().includes(q)) : rows;
  }, [query, rows]);
  const shown = expanded || query ? matching : matching.slice(0, AGENCY_PREVIEW);

  return (
    <section
      aria-labelledby="agencies-title"
      className="glass animate-fade-up rounded-2xl p-5 sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <Building2 size={17} />
          </span>
          <div>
            <h3 id="agencies-title" className="text-sm font-semibold text-ink">
              {t("agenciesTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">{t("agenciesSubtitle", { count: rows.length })}</p>
          </div>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 transition-shadow focus-within:shadow-[0_0_0_3px_rgb(225_29_72/18%)] sm:w-64">
          <Search size={15} className="shrink-0 text-ink-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("agenciesFilter")}
            aria-label={t("agenciesFilter")}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-ink-subtle">
            <th className="w-8 pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">{t("colAgency")}</th>
            <th className="hidden w-[38%] pb-2 font-medium md:table-cell">{t("colAnnouncements")}</th>
            <th className="pb-2 text-right font-medium">{t("colValue")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {shown.map((row) => {
            const rank = rows.indexOf(row) + 1;
            return (
              <tr key={row.agency} className="group transition-colors hover:bg-surface-alt/50">
                <td className="py-2.5 text-xs font-bold text-ink-subtle">{rank}</td>
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-ink">{row.agency}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted md:hidden">{t("torCount", { count: row.announcements })}</span>
                </td>
                <td className="hidden py-2.5 pr-4 md:table-cell">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent-soft">
                      <div
                        className="animate-bar h-full origin-left rounded-full bg-[var(--chart-accent)]"
                        style={{ width: `${(row.announcements / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold tabular-nums text-ink">{row.announcements}</span>
                  </div>
                </td>
                <td className="py-2.5 text-right text-sm font-semibold tabular-nums text-ink">
                  {row.value > 0 ? baht(row.value) : <span className="text-ink-subtle">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {matching.length === 0 && <p className="py-6 text-center text-sm text-ink-subtle">{t("agenciesNone")}</p>}

      {!query && rows.length > AGENCY_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft/50"
        >
          {expanded ? t("agenciesShowLess") : t("agenciesShowAll", { count: rows.length })}
        </button>
      )}
    </section>
  );
}

/** The public overview of everything TorFinder holds (see lib/site-stats.ts). */
export function Overview({ data, audience }: { data: SiteOverview; audience: Audience }) {
  const t = useTranslations("Overview");
  const tPublic = useTranslations("PublicPage");
  const locale = useLocale();
  const baht = useBahtCompact();
  const number = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  const day = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
  const stamp = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

  const tors = (count: number) => t("torCount", { count });
  const projects = (count: number) => t("projectCount", { count });

  const trend = data.weekly.map((week) => {
    const label = day.format(week.weekStart);
    return { label, tip: `${t("tableWeekOf")} ${label}`, value: week.count };
  });
  const trendTotal = trend.reduce((sum, week) => sum + week.value, 0);

  const stages = data.stages.map((row, i) => ({ label: t(`stage${i}`), value: row.count }));
  const sizes = data.sizes.map((row, i) => {
    const range = BUDGET_RANGES.find((r) => r.id === row.id)!;
    return { label: SIZE_AXIS[i], tip: tPublic(range.labelKey), value: row.count, emphasis: true };
  });
  const methods = data.methods.map((row) => ({ label: row.method ?? t("otherMethod"), value: row.count }));
  const closing = data.closing.map((band) => ({
    label: CLOSING_LABEL[band.id],
    tip: `${CLOSING_LABEL[band.id]} · ${t("closingSubtitle")}`,
    value: band.count,
    emphasis: band.id === "week",
  }));
  const average = data.valuedProjects > 0 ? data.totalValue / data.valuedProjects : 0;
  const dayLong = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
  const status = [
    { label: t("statusOpen"), value: data.status.open, color: "var(--chart-accent)" },
    { label: t("statusClosed"), value: data.status.closed, color: "var(--chart-muted)" },
    { label: t("statusUnknown"), value: data.status.unknown, color: "var(--chart-subtle)" },
  ];
  const treemap = data.agencies.filter((a) => a.value > 0).map((a) => ({ name: a.agency, value: a.value }));
  const cumulative = data.cumulative.map((week) => {
    const label = day.format(week.weekStart);
    return { label, tip: `${t("tableWeekOf")} ${label}`, value: week.total };
  });
  const gauges = [
    { label: t("gaugeReference"), value: data.transparency.referencePrice, total: data.transparency.total },
    { label: t("gaugeDeadline"), value: data.transparency.deadline, total: data.transparency.total },
    { label: t("gaugeDocuments"), value: data.transparency.documents, total: data.transparency.total },
  ];
  const savingsPercent = data.savings.referenceTotal > 0
    ? Math.round(((data.savings.referenceTotal - data.savings.awardedTotal) / data.savings.referenceTotal) * 100)
    : 0;

  const secondary =
    audience === "workspace" ? (
      <Link
        href="/matches"
        className="glass flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5"
      >
        <Sparkles size={16} className="text-accent" />
        {t("ctaMatches")}
      </Link>
    ) : audience === "guest" ? (
      <Link
        href="/signup/organization"
        className="glass flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5"
      >
        <Sparkles size={16} className="text-accent" />
        {t("ctaSignup")}
      </Link>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
      {/* Hero: the one number the page leads with, over the pulse of new work */}
      <section className="glass-strong animate-fade-up relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div
          aria-hidden
          className="animate-blob pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/15 blur-3xl"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-sm font-medium text-ink-muted">{t("heroLabel")}</h1>
            <p className="mt-1 bg-gradient-to-r from-accent via-rose-500 to-rose-400 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent sm:text-6xl">
              <CountUp value={baht(data.totalValue)} duration={1400} />
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {t("heroCaption", { projects: number.format(data.valuedProjects), agencies: number.format(data.agencyCount) })}
            </p>
            {data.updatedAt && (
              <p className="mt-1 text-xs text-ink-subtle">{t("updatedAt", { when: stamp.format(new Date(data.updatedAt)) })}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={audience === "workspace" ? "/search" : "/public"}
                className="group flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark"
              >
                <Search size={16} />
                {t("ctaSearch")}
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              {secondary}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-surface/50 p-4">
            <div className="mb-1 flex items-center gap-2 px-1">
              <LineChart size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-ink">{t("trendTitle")}</h2>
              <span className="ml-auto text-xs text-ink-muted">{t("trendSubtitle", { total: number.format(trendTotal) })}</span>
            </div>
            <TrendChart data={trend} format={tors} />
          </div>
        </div>
      </section>

      {/* Headline counts */}
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={FileStack}
          label={t("kpiAnnouncements")}
          value={number.format(data.announcements)}
          hint={t("kpiAnnouncementsHint", { projects: number.format(data.projects) })}
          delay={80}
        />
        <KpiTile
          icon={Timer}
          label={t("kpiOpen")}
          value={number.format(data.openNow)}
          visual={<Meter value={data.openNow} total={data.announcements} />}
          hint={t("kpiOpenHint", { count: data.closingThisWeek })}
          delay={140}
        />
        <KpiTile
          icon={Building2}
          label={t("kpiAgencies")}
          value={number.format(data.agencyCount)}
          hint={t("kpiAgenciesHint")}
          delay={200}
        />
        <KpiTile
          icon={Wallet}
          label={t("kpiAverage")}
          value={baht(average)}
          hint={t("kpiAverageHint", { count: number.format(data.valuedProjects) })}
          delay={260}
        />
      </dl>

      {/* Distributions */}
      <div className="mb-4 mt-10">
        <h2 className="text-lg font-bold tracking-tight text-ink">{t("chartsTitle")}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("chartsDescription")}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title={t("stagesTitle")}
          subtitle={t("stagesSubtitle")}
          icon={<Layers size={17} />}
          table={{
            head: [t("tableStage"), t("tableCount")],
            rows: data.projects === 0 ? [] : stages.map((row) => [row.label, String(row.value)]),
          }}
          delay={120}
        >
          <RankedBars data={stages} format={projects} labelWidth={136} />
        </ChartCard>

        <ChartCard
          title={t("sizesTitle")}
          subtitle={t("sizesSubtitle")}
          icon={<Ruler size={17} />}
          table={{
            head: [t("tableBand"), t("tableCount")],
            rows: data.valuedProjects === 0 ? [] : sizes.map((row) => [row.tip, String(row.value)]),
          }}
          delay={180}
        >
          <EmphasisColumns data={sizes} format={projects} />
        </ChartCard>

        <ChartCard
          title={t("methodsTitle")}
          subtitle={t("methodsSubtitle")}
          icon={<Gavel size={17} />}
          table={{ head: [t("tableMethod"), t("tableCount")], rows: methods.map((row) => [row.label, String(row.value)]) }}
          delay={240}
        >
          <RankedBars data={methods} format={projects} labelWidth={150} />
        </ChartCard>

        <ChartCard
          title={t("closingTitle")}
          subtitle={t("closingSubtitle")}
          icon={<CalendarClock size={17} />}
          table={{
            head: [t("tableBand"), t("tableCount")],
            rows: closing.every((band) => band.value === 0) ? [] : closing.map((band) => [band.tip, String(band.value)]),
          }}
          delay={300}
        >
          <EmphasisColumns data={closing} format={tors} />
        </ChartCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title={t("statusTitle")}
          subtitle={t("statusSubtitle")}
          icon={<PieIcon size={17} />}
          table={{ head: [t("tableStatus"), t("tableCount")], rows: status.map((d) => [d.label, String(d.value)]) }}
          delay={120}
        >
          <DonutChart data={status} centerValue={number.format(data.announcements)} centerLabel={t("statusCenter")} format={tors} />
        </ChartCard>
        <ChartCard
          title={t("treemapTitle")}
          subtitle={t("treemapSubtitle")}
          icon={<SquareStack size={17} />}
          table={{ head: [t("colAgency"), t("tableValue")], rows: treemap.map((d) => [d.name, baht(d.value)]) }}
          delay={180}
        >
          <ValueTreemap data={treemap} format={baht} />
        </ChartCard>
      </div>

      {/* Time and trends */}
      <div className="mb-4 mt-10">
        <h2 className="text-lg font-bold tracking-tight text-ink">{t("timeTitle")}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("timeDescription")}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          className="lg:col-span-2"
          title={t("cumulativeTitle")}
          subtitle={t("cumulativeSubtitle")}
          icon={<TrendingUp size={17} />}
          table={{ head: [t("tableWeekOf"), t("tableValue")], rows: data.totalValue === 0 ? [] : cumulative.map((d) => [d.label, baht(d.value)]) }}
          delay={120}
        >
          <ValueLine data={cumulative} format={baht} axisFormat={baht} />
        </ChartCard>
        <ChartCard
          title={t("calendarTitle")}
          subtitle={t("calendarSubtitle")}
          icon={<CalendarDays size={17} />}
          table={{
            head: [t("tableDate"), t("tableCount")],
            rows: data.calendar.counts.flatMap((count, i) =>
              count > 0 ? [[dayLong.format(data.calendar.start + i * 86_400_000 + 43_200_000), String(count)] as [string, string]] : [],
            ),
          }}
          delay={180}
        >
          <ClosingCalendar
            start={data.calendar.start}
            today={data.calendar.today}
            counts={data.calendar.counts}
            locale={locale}
            describe={(date, count) => t("calendarCell", { date, count })}
            lessLabel={t("calendarLess")}
            moreLabel={t("calendarMore")}
          />
        </ChartCard>
        <ChartCard
          title={t("scatterTitle")}
          subtitle={t("scatterSubtitle")}
          icon={<Crosshair size={17} />}
          table={{ head: [t("tableTor"), t("tableValue")], rows: data.scatter.map((d) => [d.title, baht(d.amount ?? 0)]) }}
          delay={240}
        >
          <ValueScatter
            points={data.scatter.map((d) => ({ x: d.days ?? 0, y: d.amount ?? 0, title: d.title, agency: d.agency }))}
            xLabel={t("scatterAxis")}
            urgentDays={7}
            formatValue={baht}
            formatDays={(days) => t("daysLeft", { days })}
          />
        </ChartCard>
      </div>

      {/* How complete the data is */}
      <div className="mb-4 mt-10">
        <h2 className="text-lg font-bold tracking-tight text-ink">{t("transparencyTitle")}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t("transparencyDescription")}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title={t("gaugesTitle")}
          subtitle={t("gaugesSubtitle", { total: data.transparency.total })}
          icon={<ShieldCheck size={17} />}
          table={{ head: [t("gaugesTitle"), t("tableShare")], rows: gauges.map((g) => [g.label, `${g.value}/${g.total}`]) }}
          delay={120}
        >
          <RingGauges items={gauges} />
        </ChartCard>
        <section className="glass animate-fade-up flex flex-col rounded-2xl p-5" style={{ animationDelay: "180ms" }}>
          <header className="mb-4 flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><BadgePercent size={17} /></span>
            <div>
              <h3 className="text-sm font-semibold text-ink">{t("savingsTitle")}</h3>
              <p className="mt-0.5 text-xs text-ink-muted">{t("savingsSubtitle", { count: data.savings.projects })}</p>
            </div>
          </header>
          {data.savings.projects === 0 ? (
            <p className="grid flex-1 place-items-center py-8 text-center text-sm text-ink-subtle">{t("savingsEmpty")}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-3xl font-bold tracking-tight text-ink">
                {savingsPercent >= 0 ? t("savingsUnder", { percent: savingsPercent }) : t("savingsOver", { percent: -savingsPercent })}
              </p>
              {[
                { label: t("savingsReference"), value: data.savings.referenceTotal, color: "var(--chart-muted)" },
                { label: t("savingsAwarded"), value: data.savings.awardedTotal, color: "var(--chart-accent)" },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-ink-muted">{bar.label}</span><span className="font-semibold text-ink">{baht(bar.value)}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-alt">
                    <div className="animate-bar h-full origin-left rounded-full" style={{ width: `${(bar.value / Math.max(data.savings.referenceTotal, data.savings.awardedTotal)) * 100}%`, background: bar.color }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-subtle">{t("savingsDifference", { amount: baht(Math.abs(data.savings.referenceTotal - data.savings.awardedTotal)) })}</p>
            </div>
          )}
        </section>
      </div>

      {/* Who is buying */}
      <div className="mt-5">
        <AgencyTable rows={data.agencies} delay={160} />
      </div>

      {/* Shortlists */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TorList
          title={t("closingSoonTitle")}
          icon={<Timer size={17} />}
          items={data.closingSoon}
          meta={(tor) => (
            <span className={tor.days !== null && tor.days <= 7 ? "text-danger" : ""}>{t("daysLeft", { days: tor.days ?? 0 })}</span>
          )}
          delay={120}
        />
        <TorList
          title={t("largestTitle")}
          icon={<Trophy size={17} />}
          items={data.largest}
          meta={(tor) => (tor.amount !== null ? baht(tor.amount) : "—")}
          delay={180}
        />
      </div>

      {audience === "guest" && (
        <section className="relative isolate mt-10 overflow-hidden rounded-3xl bg-zinc-950 px-6 py-10 text-center sm:px-12">
          <div aria-hidden className="animate-blob absolute -left-16 -top-16 -z-10 size-72 rounded-full bg-accent/35 blur-[90px]" />
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("guestCtaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">{t("guestCtaBody")}</p>
          <Link
            href="/signup/organization"
            className="group mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-zinc-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50"
          >
            {t("guestCtaButton")}
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </section>
      )}
    </div>
  );
}

/** Shown when the database has no announcements yet. */
export function OverviewEmpty() {
  const t = useTranslations("Overview");
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="glass animate-fade-up rounded-3xl px-6 py-14">
        <FileStack size={28} className="mx-auto mb-3 text-ink-subtle" />
        <p className="text-base font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
      </div>
    </div>
  );
}

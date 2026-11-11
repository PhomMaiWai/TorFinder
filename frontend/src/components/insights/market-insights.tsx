"use client";

import { BadgePercent, Building2, Info, Search, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ComponentType, useMemo, useState } from "react";

import { ChartCard, EmphasisColumns, RankedBars, useBahtCompact } from "@/components/dashboard/charts";
import type { AgencyInsight, MarketInsights, WinnerSpread } from "@/types/insights";

const TOP_CHART = 10;
const AGENCY_PREVIEW = 10;
/** Bands where winners cut at least this deep read as price fights — the ones the chart emphasises. */
const DEEP_BANDS = new Set(["15-25%", "25%+"]);

type Sort = "projects" | "dominance" | "discount";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function useYearLabel() {
  const locale = useLocale();
  // Thai readers count years in the Buddhist era; the API speaks Christian era.
  return (year: number) => String(locale === "th" ? year + 543 : year);
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass animate-fade-up flex flex-col rounded-2xl p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={17} />
        </span>
        <dt className="min-w-0 text-sm font-medium text-ink-muted">{label}</dt>
      </div>
      <dd className="mt-4 text-3xl font-bold leading-none tracking-tight text-ink">{value}</dd>
      <p className="mt-2.5 text-xs text-ink-subtle">{hint}</p>
    </div>
  );
}

const SPREAD_STYLE: Record<WinnerSpread, string> = {
  low: "bg-warn-soft text-warn",
  medium: "bg-surface-alt text-ink-muted",
  high: "bg-success-soft text-success",
};

function SpreadBadge({ spread }: { spread: WinnerSpread | null }) {
  const t = useTranslations("MarketInsights");
  if (!spread) return <span className="text-xs text-ink-subtle">{t("spreadUnknown")}</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${SPREAD_STYLE[spread]}`}>
      {t(`spread_${spread}`)}
    </span>
  );
}

function YearFilter({ years, current }: { years: number[]; current: number | null }) {
  const t = useTranslations("MarketInsights");
  const yearLabel = useYearLabel();
  const options: { label: string; href: string; active: boolean }[] = [
    { label: t("allYears"), href: "/insights", active: current === null },
    ...years.map((year) => ({ label: yearLabel(year), href: `/insights?year=${year}`, active: current === year })),
  ];
  return (
    <nav aria-label={t("yearFilter")} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Link
          key={option.href}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            option.active ? "bg-accent text-white" : "bg-surface-alt text-ink-muted hover:text-ink"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function sortRows(rows: AgencyInsight[], sort: Sort): AgencyInsight[] {
  const sorted = [...rows];
  if (sort === "dominance") {
    // Agencies where one company holds the most of the awards first; unjudged ones last.
    sorted.sort(
      (a, b) =>
        Number(b.competition !== null) - Number(a.competition !== null) ||
        (b.topWinners[0]?.share ?? 0) - (a.topWinners[0]?.share ?? 0) ||
        b.projects - a.projects,
    );
  } else if (sort === "discount") {
    sorted.sort((a, b) => (b.medianDiscount ?? -1) - (a.medianDiscount ?? -1) || b.projects - a.projects);
  }
  return sorted;
}

function AgencyTable({ rows }: { rows: AgencyInsight[] }) {
  const t = useTranslations("MarketInsights");
  const baht = useBahtCompact();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("projects");
  const [expanded, setExpanded] = useState(false);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (row) =>
            row.agency.toLowerCase().includes(q) ||
            row.topWinners.some((winner) => winner.vendor.toLowerCase().includes(q)),
        )
      : rows;
    return sortRows(filtered, sort);
  }, [query, rows, sort]);
  const shown = expanded || query ? matching : matching.slice(0, AGENCY_PREVIEW);

  return (
    <section aria-labelledby="insight-agencies" className="glass animate-fade-up rounded-2xl p-5 sm:p-6">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <Building2 size={17} />
          </span>
          <div>
            <h2 id="insight-agencies" className="text-sm font-semibold text-ink">
              {t("agenciesTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">{t("agenciesSubtitle", { count: rows.length })}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 sm:w-64">
            <Search size={15} className="shrink-0 text-ink-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("agenciesFilter")}
              aria-label={t("agenciesFilter")}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label={t("sortLabel")}
            className="h-10 rounded-xl border border-border/70 bg-surface/70 px-3 text-sm text-ink"
          >
            <option value="projects">{t("sort_projects")}</option>
            <option value="dominance">{t("sort_dominance")}</option>
            <option value="discount">{t("sort_discount")}</option>
          </select>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-ink-subtle">
              <th className="pb-2 font-medium">{t("colAgency")}</th>
              <th className="pb-2 text-right font-medium">{t("colProjects")}</th>
              <th className="pb-2 pl-4 font-medium">{t("colTopWinners")}</th>
              <th className="pb-2 text-right font-medium">{t("colDistinct")}</th>
              <th className="pb-2 text-right font-medium">{t("colDiscount")}</th>
              <th className="pb-2 pl-4 font-medium">{t("colSpread")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {shown.map((row) => (
              <tr key={row.agency} className="align-top transition-colors hover:bg-surface-alt/50">
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-ink">{row.agency}</span>
                  {row.totalAwarded > 0 && (
                    <span className="mt-0.5 block text-xs text-ink-muted">{t("awardedTotal", { amount: baht(row.totalAwarded) })}</span>
                  )}
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums text-ink">{row.projects}</td>
                <td className="py-2.5 pl-4">
                  {row.topWinners.length === 0 ? (
                    <span className="text-xs text-ink-subtle">{t("noWinnerNamed")}</span>
                  ) : (
                    <ol className="space-y-0.5">
                      {row.topWinners.map((winner) => (
                        <li key={winner.vendor} className="flex items-baseline gap-2 text-xs">
                          <span className="min-w-0 flex-1 text-ink">{winner.vendor}</span>
                          <span className="shrink-0 tabular-nums text-ink-muted">
                            {t("winsShare", { wins: winner.wins, share: percent(winner.share) })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">{row.distinctWinners}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {row.medianDiscount === null ? (
                    <span className="text-xs text-ink-subtle" title={t("discountTooFew")}>
                      —
                    </span>
                  ) : (
                    <span title={t("discountTitle", { count: row.priced, average: percent(row.averageDiscount ?? 0) })}>
                      {percent(row.medianDiscount)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pl-4">
                  <SpreadBadge spread={row.competition} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matching.length === 0 && <p className="py-6 text-center text-sm text-ink-subtle">{t("agenciesNone")}</p>}

      {!query && matching.length > AGENCY_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft/50"
        >
          {expanded ? t("showLess") : t("showAll", { count: matching.length })}
        </button>
      )}
    </section>
  );
}

export function MarketInsightsView({ data }: { data: MarketInsights }) {
  const t = useTranslations("MarketInsights");
  const baht = useBahtCompact();
  const yearLabel = useYearLabel();
  const { summary } = data;

  const winnerBars = data.topWinners.slice(0, TOP_CHART).map((winner) => ({ label: winner.vendor, value: winner.wins }));
  const bands = data.discountBands.map((band) => ({
    label: band.band,
    tip: t("bandTip", { band: band.band }),
    value: band.projects,
    emphasis: DEEP_BANDS.has(band.band),
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
      <section className="glass-strong animate-fade-up rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">{t("eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">{t("subtitle")}</p>
        <div className="mt-5">
          <YearFilter years={data.years} current={data.year} />
        </div>
      </section>

      {summary.projects === 0 ? (
        <div className="glass mx-auto mt-6 max-w-lg rounded-3xl px-6 py-14 text-center">
          <Trophy size={28} className="mx-auto mb-3 text-ink-subtle" />
          <p className="text-base font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {data.year === null ? t("emptyBody") : t("emptyYear", { year: yearLabel(data.year) })}
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              icon={Trophy}
              label={t("kpiProjects")}
              value={String(summary.projects)}
              hint={t("kpiProjectsHint", { named: summary.withWinner, total: baht(summary.totalAwarded) })}
            />
            <Tile
              icon={Users}
              label={t("kpiWinners")}
              value={String(summary.distinctWinners)}
              hint={t("kpiWinnersHint", { agencies: summary.agencies })}
            />
            <Tile
              icon={BadgePercent}
              label={t("kpiDiscount")}
              value={summary.medianDiscount === null ? "—" : percent(summary.medianDiscount)}
              hint={
                summary.medianDiscount === null
                  ? t("kpiDiscountNone")
                  : t("kpiDiscountHint", { average: percent(summary.averageDiscount ?? 0), count: summary.priced })
              }
            />
            <Tile
              icon={Info}
              label={t("kpiBase")}
              value={`${summary.referenceBased} / ${summary.priced}`}
              hint={t("kpiBaseHint", { budget: summary.budgetBased })}
            />
          </dl>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <ChartCard
              title={t("winnersTitle")}
              subtitle={t("winnersSubtitle")}
              icon={<Trophy size={17} />}
              table={{
                head: [t("colVendor"), t("colWins")],
                rows: data.topWinners.map((winner) => [
                  winner.vendor,
                  t("winnerRow", { wins: winner.wins, agencies: winner.agencies, total: baht(winner.totalAwarded) }),
                ]),
              }}
            >
              <RankedBars data={winnerBars} format={(value) => t("winsCount", { count: value })} labelWidth={168} />
            </ChartCard>
            <ChartCard
              title={t("bandsTitle")}
              subtitle={t("bandsSubtitle")}
              icon={<BadgePercent size={17} />}
              footnote={t("bandsFootnote")}
              table={{
                head: [t("colBand"), t("colProjects")],
                rows: summary.priced === 0 ? [] : data.discountBands.map((band) => [band.band, String(band.projects)]),
              }}
            >
              <EmphasisColumns data={bands} format={(value) => t("projectsCount", { count: value })} />
            </ChartCard>
          </div>

          <div className="mt-6">
            <AgencyTable rows={data.agencies} />
          </div>
        </>
      )}

      <aside className="mt-6 rounded-2xl border border-border/60 bg-surface/60 p-5 text-xs leading-relaxed text-ink-muted">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <Info size={14} /> {t("limitsTitle")}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("limitBids")}</li>
          <li>{t("limitBase")}</li>
          <li>{t("limitSpread")}</li>
          <li>{t("limitSources")}</li>
        </ul>
      </aside>
    </div>
  );
}

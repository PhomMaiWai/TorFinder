"use client";

import {
  Bookmark,
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  ExternalLink,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DashboardInsights, KpiRow } from "@/components/dashboard/dashboard-insights";
import { AppShell } from "@/components/layout/app-sidebar";
import { BiddingBadge } from "@/components/public/bidding-badge";
import { CountUp } from "@/components/ui/count-up";
import { HIGH_MATCH } from "@/lib/dashboard-stats";
import type { CompanySummary } from "@/lib/opportunities-api";
import { biddingOf, daysUntilClose, isClosingSoon, torAmount } from "@/lib/tor-ui";
import { useSavedTors } from "@/lib/use-saved-tors";
import type { EligibilityCheck, ScoredTor } from "@/types/tor";

type DashboardProps = {
  company: CompanySummary | null;
  /** Null when there is no profile to match against yet. */
  opportunities: ScoredTor[] | null;
};

const FILTERS = ["all", "eligible", "highMatch", "closingSoon"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL = {
  all: "filterAll",
  eligible: "filterEligible",
  highMatch: "filterHighMatch",
  closingSoon: "filterClosingSoon",
} as const satisfies Record<Filter, string>;

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

function MatchRing({ score, strong }: { score: number; strong: boolean }) {
  return (
    <div className="relative hidden size-14 shrink-0 sm:block">
      <svg viewBox="0 0 60 60" className="size-full -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r={RING_R} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="30"
          cy="30"
          r={RING_R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={`animate-ring ${strong ? "stroke-accent" : "stroke-ink-subtle"}`}
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - score / 100)}
          style={{ "--ring-c": RING_C } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-bold leading-none tracking-tight ${strong ? "text-accent" : "text-ink"}`}>
          {score}
        </span>
        <span className="text-2xs font-medium text-ink-subtle">Match</span>
      </div>
    </div>
  );
}

const CHECK_STYLE = {
  pass: { icon: CircleCheck, cls: "text-success" },
  fail: { icon: CircleAlert, cls: "text-danger" },
  unknown: { icon: CircleHelp, cls: "text-ink-subtle" },
} as const;

function EligibilityList({ checks }: { checks: EligibilityCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {checks.map((check) => {
        const { icon: Icon, cls } = CHECK_STYLE[check.status];
        return (
          <li key={check.requirement} className={`flex items-center gap-1.5 text-xs font-medium ${cls}`}>
            <Icon size={13} className="shrink-0" />
            {check.requirement}
          </li>
        );
      })}
    </ul>
  );
}

function OpportunityCard({
  opportunity,
  isSaved,
  onSaveToggle,
  index,
}: {
  opportunity: ScoredTor;
  isSaved: boolean;
  onSaveToggle: (id: string) => void;
  index: number;
}) {
  const t = useTranslations("Dashboard");
  const bidding = biddingOf(opportunity);
  const daysLeft = daysUntilClose(opportunity);
  const urgent = isClosingSoon(opportunity);
  const strong = opportunity.match >= HIGH_MATCH;

  return (
    <article
      className="animate-fade-up group p-5 transition-colors duration-200 hover:bg-accent-soft/30"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex gap-4 sm:gap-5">
        <MatchRing score={opportunity.match} strong={strong} />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <BiddingBadge bidding={bidding} />
            {opportunity.eligible === true && (
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-2xs font-semibold text-success">
                {t("eligiblePass")}
              </span>
            )}
            {opportunity.eligible === false && (
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-2xs font-semibold text-danger">
                {t("eligibleFail")}
              </span>
            )}
            <span className="rounded-full bg-surface-alt px-2.5 py-1 text-2xs font-medium text-ink-muted sm:hidden">
              {opportunity.match}% Match
            </span>
          </div>

          <Link href={`/tor/${opportunity.id}?in=app`}>
            <h3 className="text-base font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
              {opportunity.title}
            </h3>
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
            <span className="flex min-w-0 items-center gap-1.5">
              <Building2 size={15} className="shrink-0 text-ink-subtle" />
              <span className="truncate">{opportunity.agency}</span>
            </span>
            <span className="font-medium text-ink">{torAmount(opportunity).value}</span>
            {daysLeft !== null && bidding.status === "open" && (
              <span className={`flex items-center gap-1.5 ${urgent ? "font-semibold text-danger" : ""}`}>
                <Clock size={15} className={urgent ? "text-danger" : "text-ink-subtle"} />
                {t("daysLeftLabel", { days: daysLeft })}
              </span>
            )}
          </div>

          <EligibilityList checks={opportunity.eligibility} />

          {(opportunity.reasons[0] || opportunity.gaps[0]) && (
            <ul className="mt-3 space-y-0.5 text-xs">
              {opportunity.reasons[0] && <li className="text-ink-muted">· {opportunity.reasons[0]}</li>}
              {opportunity.gaps[0] && <li className="text-warn">· {opportunity.gaps[0]}</li>}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label={isSaved ? t("unsaveAriaLabel") : t("saveAriaLabel")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                isSaved ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              }`}
              onClick={() => onSaveToggle(opportunity.id)}
            >
              <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? t("savedButtonText") : t("saveButtonText")}
            </button>
            <Link
              href={`/tor/${opportunity.id}?in=app`}
              className="flex h-8 items-center rounded-lg bg-ink px-3 text-sm font-medium text-surface transition-all duration-200 hover:-translate-y-px hover:opacity-90"
            >
              {t("viewDetails")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function DeadlinePanel({ opportunities }: { opportunities: ScoredTor[] }) {
  const t = useTranslations("Dashboard");
  const closing = opportunities
    .map((opp) => ({ opp, days: biddingOf(opp).status === "open" ? daysUntilClose(opp) : null }))
    .filter((row): row is { opp: ScoredTor; days: number } => row.days !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  if (closing.length === 0) return null;

  return (
    <div className="glass animate-fade-up overflow-hidden rounded-2xl" style={{ animationDelay: "200ms" }}>
      <p className="border-b border-border/60 px-4 py-3 text-sm font-semibold text-ink">{t("deadlinePanelTitle")}</p>
      <div className="divide-y divide-border/60">
        {closing.map(({ opp, days }) => (
          <Link
            key={opp.id}
            href={`/tor/${opp.id}?in=app`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-alt"
          >
            <p className="min-w-0 flex-1 truncate text-sm text-ink">{opp.title}</p>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                days <= 7 ? "bg-danger-soft text-danger" : "bg-surface-alt text-ink-muted"
              }`}
            >
              {t("daysAbbrev", { days })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel({ company }: { company: CompanySummary | null }) {
  const t = useTranslations("Dashboard");
  const items = [
    { label: t("profileItemWorkTypes"), done: Boolean(company?.workTypes?.length) },
    { label: t("profileItemPastContract"), done: Boolean(company?.largestPastContract) },
    { label: t("profileItemCapital"), done: Boolean(company?.registeredCapital) },
    { label: t("profileItemCertifications"), done: company?.certifications !== undefined },
    { label: t("profileItemBudget"), done: Boolean(company?.preferredBudgetMin || company?.preferredBudgetMax) },
  ];
  const percent = Math.round((items.filter((item) => item.done).length / items.length) * 100);

  return (
    <div className="glass animate-fade-up overflow-hidden rounded-2xl" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <p className="text-sm font-semibold text-ink">{t("companyProfileTitle")}</p>
        <Link href="/profile" className="text-xs font-medium text-accent hover:text-accent-dark">
          {t("editLink")}
        </Link>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-ink-muted">{t("completionLabel")}</span>
          <span className="font-bold text-ink"><CountUp value={`${percent}%`} /></span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div className="animate-bar h-full origin-left rounded-full bg-gradient-to-r from-rose-400 to-accent" style={{ width: `${percent}%` }} />
        </div>
        <ul className="mt-4 space-y-2">
          {items.map(({ label, done }) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-accent text-white" : "border-2 border-border"
                }`}
              >
                {done && <Check size={9} strokeWidth={3} />}
              </span>
              <span className={done ? "text-ink-muted" : "font-medium text-ink"}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Dashboard({ company, opportunities }: DashboardProps) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { savedIds, toggleSaved } = useSavedTors();
  const [toast, setToast] = useState("");
  const list = useMemo(() => opportunities ?? [], [opportunities]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((opp) => {
      if (q && !`${opp.title} ${opp.agency}`.toLowerCase().includes(q)) return false;
      if (filter === "eligible") return opp.eligible === true;
      if (filter === "highMatch") return opp.match >= HIGH_MATCH;
      if (filter === "closingSoon") return isClosingSoon(opp);
      return true;
    });
  }, [filter, list, query]);

  function handleSaveToggle(id: string) {
    const wasSaved = savedIds.includes(id);
    toggleSaved(id);
    setToast(wasSaved ? t("toastRemoved") : t("toastSaved"));
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <AppShell>
      <main className="aurora flex min-h-screen flex-col bg-surface-alt/50">
        <header className="px-4 pb-2 pt-8 sm:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="animate-fade-up">
                <p className="mb-1 text-xs font-medium tracking-wide text-ink-muted">
                  {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
                    dateStyle: "full",
                    timeZone: "Asia/Bangkok",
                  }).format(new Date())}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {t("greeting", { name: company?.companyName ?? t("companyFallback") })}
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-ink-muted">{t("overviewDescription")}</p>
              </div>
              <div className="animate-fade-up flex flex-wrap gap-2" style={{ animationDelay: "80ms" }}>
                <Link
                  href="/profile"
                  className="glass flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5"
                >
                  <UserRound size={16} className="text-ink-muted" />
                  {t("companyProfileTitle")}
                </Link>
                <Link
                  href="/search"
                  className="group flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark"
                >
                  <Search size={16} />
                  {t("viewNewOpportunities")}
                </Link>
              </div>
            </div>

            {opportunities && (
              <div className="mt-6">
                <KpiRow list={list} savedCount={savedIds.length} />
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
          {opportunities === null ? (
            <div className="glass animate-fade-up mx-auto max-w-lg rounded-2xl px-6 py-14 text-center">
              <Building2 size={28} className="mx-auto mb-3 text-ink-subtle" />
              <p className="text-base font-semibold text-ink">{t("noProfileTitle")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("noProfileDescription")}</p>
              <Link
                href="/profile"
                className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-accent-dark"
              >
                {t("setupProfileLink")}
              </Link>
            </div>
          ) : (
            <>
              <DashboardInsights list={list} />

              <div className="glass-strong animate-fade-up sticky top-3 z-20 mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-2 pl-4 transition-shadow focus-within:shadow-[0_0_0_3px_rgb(225_29_72/18%)]" style={{ animationDelay: "150ms" }}>
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <Search size={18} className="shrink-0 text-ink-subtle" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((key) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                        filter === key ? "bg-ink text-surface shadow-sm" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
                      }`}
                    >
                      {t(FILTER_LABEL[key])}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                <section className="min-w-0">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-ink">{t("recommendedTitle")}</h2>
                    <Link
                      href="/search"
                      className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
                    >
                      {t("viewNewOpportunities")} <ExternalLink size={13} />
                    </Link>
                  </div>
                  <div className="glass overflow-hidden rounded-2xl">
                    {visible.length === 0 ? (
                      <div className="px-5 py-20 text-center">
                        <Search size={28} className="mx-auto mb-3 text-ink-subtle" />
                        <p className="text-base font-medium text-ink">
                          {list.length === 0 ? t("noMatchesYetTitle") : t("emptyStateTitle")}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {list.length === 0 ? t("noMatchesYetDescription") : t("emptyStateDescription")}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {visible.map((opp, index) => (
                          <OpportunityCard
                            key={opp.id}
                            opportunity={opp}
                            isSaved={savedIds.includes(opp.id)}
                            onSaveToggle={handleSaveToggle}
                            index={index}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <aside className="min-w-0 space-y-5 xl:sticky xl:top-7 xl:self-start">
                  <DeadlinePanel opportunities={list} />
                  <ProfilePanel company={company} />
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      {toast && (
        <div
          className="animate-toast fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-zinc-900/90 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md"
          role="status"
        >
          <Check size={14} />
          {toast}
        </div>
      )}
    </AppShell>
  );
}

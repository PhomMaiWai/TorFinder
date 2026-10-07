"use client";

import {
  AlertTriangle,
  Bookmark,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageSquare,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";

import {
  type AmountKind,
  biddingOf,
  daysUntilClose,
  isClosingSoon,
  isKnown,
  sourcePageUrl,
  stageBadgeCls,
  torAmount,
  torDocumentUrl,
} from "@/lib/tor-ui";
import { useSavedTors } from "@/lib/use-saved-tors";
import type { TorRecord } from "@/types/tor";

import { BiddingBadge } from "./bidding-badge";

import { AgencyFilter } from "./agency-filter";
import { FilterCheckbox } from "./filter-checkbox";

/**
 * One status a reader filters by, in the order they care: what they can still
 * act on first. It folds together three things that used to be separate
 * filters — whether bidding is open, the announcement stage, and the
 * announcement type — which said the same thing three ways.
 */
type TorStatus = "bidding" | "comment" | "awarded" | "closed" | "unknown";

const STATUSES: readonly TorStatus[] = ["bidding", "comment", "awarded", "closed", "unknown"];

/** Everything a reader can still act on: bid now, or comment on what is coming. */
const OPEN_STATUSES: readonly TorStatus[] = ["bidding", "comment"];

const STATUS_LABEL_KEY: Record<TorStatus, string> = {
  bidding: "statusBidding",
  comment: "statusComment",
  awarded: "statusAwarded",
  closed: "statusClosed",
  unknown: "statusUnknown",
};

function statusOf(tor: TorRecord): TorStatus {
  const { status, reason } = biddingOf(tor);
  // Bid now, or plan for what is coming — two different jobs, so two options;
  // the "all open" shortcut puts them back together.
  if (status === "open") return tor.stage === "เปิดรับฟังความคิดเห็น" ? "comment" : "bidding";
  if (status === "unknown") return "unknown";
  return reason === "awarded" || reason === "contracted" ? "awarded" : "closed";
}
const AMOUNT_LABEL = {
  budget: "budgetLabel",
  awarded: "awardedLabel",
  reference: "referencePriceLabel",
} as const satisfies Record<AmountKind, string>;
const PER_PAGE = 10;

const BUDGET_RANGES = [
  { id: "under-5m", labelKey: "budgetRangeUnder5m", min: 0, max: 5_000_000 },
  { id: "5m-10m", labelKey: "budgetRange5to10m", min: 5_000_000, max: 10_000_000 },
  { id: "10m-20m", labelKey: "budgetRange10to20m", min: 10_000_000, max: 20_000_000 },
  { id: "over-20m", labelKey: "budgetRangeOver20m", min: 20_000_000, max: Infinity },
] as const;

/** Bangkok time: an announcement made on 1 Jan local time is stored as 31 Dec UTC. */
const YEAR = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" });

/** The year an announcement was published, or null when the record carries no date. */
function announcedYear(createdAt: string): number | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : Number(YEAR.format(date));
}

/** Thai readers count in พ.ศ.; the ค.ศ. year is kept alongside for everyone else. */
function yearLabel(year: number): string {
  return `${year + 543} (${year})`;
}

/** null when the announcement doesn't state a budget, so it can't match a range. */
function parseBudget(budget: string): number | null {
  if (!isKnown(budget)) return null;
  const digits = budget.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function CheckboxFilter({
  title,
  options,
  selected,
  onChange,
  labelOf = (opt) => opt,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  labelOf?: (opt: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mb-7">
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-2.5">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-start gap-3">
            <span className="mt-0.5">
              <FilterCheckbox
                checked={selected.includes(opt)}
                onChange={(checked) =>
                  onChange(checked ? [...selected, opt] : selected.filter((x) => x !== opt))
                }
              />
            </span>
            <span className="text-sm leading-snug text-ink-muted">{labelOf(opt)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * The status filter. The two open statuses sit under one parent box — "what can
 * I still act on" is where most readers start — and either can still be picked
 * on its own. The parent shows a dash when only one of them is.
 */
function StatusFilter({
  title,
  allOpenLabel,
  statuses,
  selected,
  onChange,
  labelOf,
}: {
  title: string;
  allOpenLabel: string;
  statuses: readonly TorStatus[];
  selected: TorStatus[];
  onChange: (statuses: TorStatus[]) => void;
  labelOf: (status: TorStatus) => string;
}) {
  if (statuses.length === 0) return null;

  // Rebuilt in the canonical order, so the selection reads the same however it was clicked.
  const setMany = (targets: readonly TorStatus[], on: boolean) =>
    onChange(STATUSES.filter((status) => (targets.includes(status) ? on : selected.includes(status))));

  const openOptions = OPEN_STATUSES.filter((status) => statuses.includes(status));
  const openPicked = openOptions.filter((status) => selected.includes(status));

  const row = (status: TorStatus, nested: boolean) => (
    <label key={status} className={`flex cursor-pointer items-start gap-3 ${nested ? "pl-7" : ""}`}>
      <span className="mt-0.5">
        <FilterCheckbox checked={selected.includes(status)} onChange={(on) => setMany([status], on)} />
      </span>
      <span className="text-sm leading-snug text-ink-muted">{labelOf(status)}</span>
    </label>
  );

  return (
    <div className="mb-7">
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-2.5">
        {openOptions.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3">
            <span className="mt-0.5">
              <FilterCheckbox
                checked={openPicked.length === openOptions.length}
                indeterminate={openPicked.length > 0}
                onChange={(on) => setMany(openOptions, on)}
              />
            </span>
            <span className="text-sm font-medium leading-snug text-ink">{allOpenLabel}</span>
          </label>
        )}
        {openOptions.map((status) => row(status, true))}
        {statuses.filter((status) => !OPEN_STATUSES.includes(status)).map((status) => row(status, false))}
      </div>
    </div>
  );
}

function PublicTorCard({
  tor,
  detailHref,
  isFeedbackOpen,
  feedbackText,
  onFeedbackChange,
  onToggleFeedback,
  onSubmitFeedback,
  isSaved,
  onToggleSave,
}: {
  tor: TorRecord;
  detailHref: string;
  isFeedbackOpen: boolean;
  feedbackText: string;
  onFeedbackChange: (val: string) => void;
  onToggleFeedback: () => void;
  onSubmitFeedback: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const t = useTranslations("PublicPage");
  const bidding = biddingOf(tor);
  const amount = torAmount(tor);
  const isFeedbackStage = tor.stage === "เปิดรับฟังความคิดเห็น" && bidding.status !== "closed";
  const daysLeft = daysUntilClose(tor);
  const isUrgent = isClosingSoon(tor);
  // The announcement's own page on the portal; a file only when there is no page.
  const originalUrl = sourcePageUrl(tor) ?? torDocumentUrl(tor);

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border hover:shadow-[0_8px_30px_rgb(24,24,27/6%)]">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wide ${stageBadgeCls(tor.stage)}`}
            >
              {tor.stage}
            </span>
            <BiddingBadge bidding={bidding} />
            {tor.budgetStatus === "สูงกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-1 text-2xs font-semibold text-red-700">
                <TrendingUp size={12} />
                {t("budgetHighBadge")}
              </span>
            )}
            {tor.budgetStatus === "ต่ำกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-2xs font-semibold text-amber-700">
                <TrendingDown size={12} />
                {t("budgetLowBadge")}
              </span>
            )}
            {tor.budgetStatus === "ปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-1 text-2xs font-semibold text-green-700">
                <CheckCircle2 size={12} />
                {t("budgetNormalBadge")}
              </span>
            )}
            {tor.hasVendorMismatch && (
              <span className="flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-1 text-2xs font-semibold text-red-700">
                <AlertTriangle size={12} />
                {t("vendorMismatchBadge")}
              </span>
            )}
            {tor.isNew && (
              <span className="rounded-full bg-surface-alt px-2.5 py-1 text-2xs font-medium text-ink-muted">
                {t("newBadge")}
              </span>
            )}
            {isUrgent && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-2xs font-semibold text-red-600">
                <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                {t("urgentBadge")}
              </span>
            )}
          </div>

          <h3 className="text-lg font-bold text-ink sm:text-lg">{tor.title}</h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-ink-subtle" />
              {tor.agency}
            </span>
            {daysLeft !== null && (
              <span
                className={`flex items-center gap-1.5 ${isUrgent ? "font-medium text-red-600" : ""}`}
              >
                <Clock size={15} className={isUrgent ? "text-red-500" : "text-ink-subtle"} />
                {bidding.status === "closed"
                  ? t("deadlineClosed")
                  : t("daysLeftLabel", { days: daysLeft })}
                {bidding.status !== "closed" && bidding.submissionTime && (
                  <> · {t("submissionTime", { time: bidding.submissionTime })}</>
                )}
              </span>
            )}
          </div>

          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{tor.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {tor.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface-alt px-2.5 py-1 text-2xs font-medium text-ink-muted ring-1 ring-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start justify-between border-t border-border pt-5 sm:w-[220px] sm:items-end sm:border-none sm:pl-6 sm:pt-0">
          <div className="mb-4 flex w-full items-start justify-between gap-3 sm:mb-0 sm:flex-col sm:items-end">
            <div className="sm:text-right">
              <div className="mb-1 text-xs font-medium text-ink-muted">
                {t(AMOUNT_LABEL[amount.kind])}
              </div>
              <div className="text-lg font-bold text-ink">{amount.value}</div>
            </div>
            <button
              onClick={onToggleSave}
              aria-label={isSaved ? t("unsaveAriaLabel") : t("saveAriaLabel")}
              className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors sm:mt-1 ${
                isSaved
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-alt text-ink-subtle hover:bg-border hover:text-ink-muted"
              }`}
            >
              <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2 sm:mt-auto">
            {isFeedbackStage && (
              <button
                onClick={onToggleFeedback}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-alt py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
              >
                <MessageSquare size={14} />
                {isFeedbackOpen ? t("closeFeedbackButton") : t("openFeedbackButton")}
              </button>
            )}
            <Link
              href={detailHref}
              className="flex w-full items-center justify-center rounded-lg bg-ink py-2 text-sm font-medium text-white transition-colors hover:bg-ink"
            >
              {t("viewDetails")}
            </Link>
            {/* A few records carry no link at all, so only offer one that opens. */}
            {originalUrl && (
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt"
              >
                <ExternalLink size={14} />
                {t("viewOriginal")}
              </a>
            )}
          </div>
        </div>
      </div>

      {isFeedbackOpen && (
        <div className="border-t border-border bg-surface-alt/50 p-5 sm:p-6">
          <label className="mb-2 block text-sm font-semibold text-ink">
            {t("feedbackFormLabel")}
          </label>
          <textarea
            className="w-full rounded-xl border border-border bg-surface p-3.5 text-sm text-ink shadow-sm outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            rows={3}
            value={feedbackText}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-2xs text-ink-muted">
              {t("feedbackDisclaimer")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onToggleFeedback}
                className="rounded-lg px-4 py-2 text-xs font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
              >
                {t("cancelButton")}
              </button>
              <button
                onClick={onSubmitFeedback}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-dark"
              >
                {t("submitFeedbackButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/** `inApp`: rendered inside the signed-in shell, so a TOR opens there too. */
export function TorSearch({ tors, inApp = false }: { tors: TorRecord[]; inApp?: boolean }) {
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TorStatus[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([]);
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastQueryKey, setLastQueryKey] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { savedIds, toggleSaved } = useSavedTors();
  const t = useTranslations("PublicPage");

  // Filter options come from what was actually announced, not a fixed list.
  const agencies = useMemo(() => tors.map((t) => t.agency), [tors]);
  // Only the statuses something actually has — an empty option is a dead end.
  const statuses = useMemo(() => {
    const present = new Set(tors.map(statusOf));
    return STATUSES.filter((status) => present.has(status));
  }, [tors]);
  // Newest first: the current year is the one a reader almost always wants.
  const years = useMemo(
    () =>
      [...new Set(tors.map((t) => announcedYear(t.createdAt)))]
        .filter((year): year is number => year !== null)
        .sort((a, b) => b - a),
    [tors],
  );

  // Typing stays responsive; the list catches up once React has a spare frame.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return tors.filter((tor) => {
      const matchSearch =
        !q ||
        `${tor.title} ${tor.agency} ${tor.summary} ${tor.tags.join(" ")}`
          .toLowerCase()
          .includes(q);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(statusOf(tor));
      const year = announcedYear(tor.createdAt);
      const matchYear =
        selectedYears.length === 0 || (year !== null && selectedYears.includes(year));
      const matchAgency = selectedAgencies.length === 0 || selectedAgencies.includes(tor.agency);

      const budgetValue = parseBudget(tor.budget);
      const matchBudget =
        selectedBudgets.length === 0 ||
        (budgetValue !== null &&
          selectedBudgets.some((id) => {
            const range = BUDGET_RANGES.find((r) => r.id === id);
            return !!range && budgetValue >= range.min && budgetValue <= range.max;
          }));

      return (
        matchSearch &&
        matchStatus &&
        matchYear &&
        matchAgency &&
        matchBudget
      );
    });
  }, [tors, deferredSearch, selectedStatuses, selectedYears, selectedAgencies, selectedBudgets]);

  // Any change to the query lands the reader back on the first page of results.
  const queryKey = JSON.stringify([
    search,
    selectedStatuses,
    selectedYears,
    selectedAgencies,
    selectedBudgets,
  ]);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSubmitFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackOpenId(null);
    setFeedbackText("");
  }

  function clearAllFilters() {
    setSelectedStatuses([]);
    setSelectedYears([]);
    setSelectedAgencies([]);
    setSelectedBudgets([]);
    setSearch("");
  }

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedYears.length > 0 ||
    selectedAgencies.length > 0 ||
    selectedBudgets.length > 0;

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex w-full items-center justify-between lg:hidden">
        <span className="text-sm font-semibold text-ink">
          {t("resultsCountMobile", { count: filtered.length })}
        </span>
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm"
        >
          <SlidersHorizontal size={16} />
          {t("filtersButton")}
        </button>
      </div>

      {/* On desktop the filters stay in view and scroll on their own, below the
          sticky navbar (h-14), so a long filter list never drags the results. */}
      <aside
        className={`w-full shrink-0 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:w-[280px] lg:overflow-y-auto lg:overscroll-contain xl:w-[320px] ${
          showMobileFilters ? "block" : "hidden"
        }`}
      >
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <SlidersHorizontal size={18} /> {t("filtersButton")}
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm font-medium text-accent hover:text-accent-dark"
              >
                {t("clearAllFilters")}
              </button>
            )}
          </div>

          <div className="mb-7">
            <label className="mb-3 block text-sm font-bold text-ink">{t("searchLabel")}</label>
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
                size={16}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchInputPlaceholder")}
                className="w-full rounded-xl border border-border bg-surface-alt py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition-colors focus:border-accent/40 focus:bg-surface focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div className="mb-7 h-px w-full bg-surface-alt" />

          <StatusFilter
            title={t("filterStatusTitle")}
            allOpenLabel={t("statusAllOpen")}
            statuses={statuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            labelOf={(status) => t(STATUS_LABEL_KEY[status])}
          />

          <div className="mb-7 h-px w-full bg-surface-alt" />

          <CheckboxFilter
            title={t("filterYearTitle")}
            options={years.map(yearLabel)}
            selected={selectedYears.map(yearLabel)}
            onChange={(labels) => setSelectedYears(years.filter((y) => labels.includes(yearLabel(y))))}
          />

          <div className="mb-7 h-px w-full bg-surface-alt" />

          <CheckboxFilter
            title={t("filterBudgetTitle")}
            options={BUDGET_RANGES.map((r) => t(r.labelKey))}
            selected={selectedBudgets.map((id) => t(BUDGET_RANGES.find((r) => r.id === id)!.labelKey))}
            onChange={(labels) =>
              setSelectedBudgets(
                BUDGET_RANGES.filter((r) => labels.includes(t(r.labelKey))).map((r) => r.id),
              )
            }
          />

          <div className="mb-7 h-px w-full bg-surface-alt" />

          <AgencyFilter
            title={t("filterAgencyTitle")}
            agencies={agencies}
            selected={selectedAgencies}
            onChange={setSelectedAgencies}
          />

        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-5 hidden items-center justify-between lg:flex">
          <h2 className="text-base font-semibold text-ink">
            {t.rich("resultsCount", {
              count: filtered.length,
              strong: (chunks) => <span className="text-ink">{chunks}</span>,
            })}
          </h2>
        </div>

        {tors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <AlertTriangle size={32} className="mx-auto mb-4 text-ink-subtle" />
            <h3 className="text-base font-semibold text-ink">{t("noRecordsTitle")}</h3>
            <p className="mt-1 text-base text-ink-muted">
              {t("noRecordsDescription")}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Search size={32} className="mx-auto mb-4 text-ink-subtle" />
            <h3 className="text-base font-semibold text-ink">{t("emptyStateTitle")}</h3>
            <p className="mt-1 text-base text-ink-muted">{t("emptyStateDescription")}</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 rounded-lg bg-surface-alt px-5 py-2 text-sm font-medium text-ink hover:bg-border"
              >
                {t("clearAllFiltersButton")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((tor) => (
              <PublicTorCard
                key={tor.id}
                tor={tor}
                detailHref={`/tor/${tor.id}${inApp ? "?in=app" : ""}`}
                isFeedbackOpen={feedbackOpenId === tor.id}
                feedbackText={feedbackText}
                onFeedbackChange={setFeedbackText}
                onToggleFeedback={() => {
                  if (feedbackOpenId === tor.id) {
                    setFeedbackOpenId(null);
                  } else {
                    setFeedbackOpenId(tor.id);
                    setFeedbackText("");
                  }
                }}
                onSubmitFeedback={handleSubmitFeedback}
                isSaved={savedIds.includes(tor.id)}
                onToggleSave={() => toggleSaved(tor.id)}
              />
            ))}

            {pageCount > 1 && (
              <nav className="flex items-center justify-between pt-2" aria-label={t("pageIndicator", { page, total: pageCount })}>
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  {t("prevPage")}
                </button>
                <span className="text-sm text-ink-muted">
                  {t("pageIndicator", { page, total: pageCount })}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pageCount}
                  className="flex items-center gap-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("nextPage")}
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

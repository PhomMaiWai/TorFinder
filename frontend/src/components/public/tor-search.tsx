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
  BUDGET_RANGES,
  DEADLINE_RANGES,
  daysUntilClose,
  isClosingSoon,
  matchesDeadline,
  sourcePageUrl,
  stageBadgeCls,
  torAmount,
  torDocumentUrl,
} from "@/lib/tor-ui";
import {
  NO_FILTERS,
  type SearchFilters,
  STATUS_LABEL_KEY,
  STATUSES,
  type TorStatus,
  yearLabel,
} from "@/lib/search-filters";
import { DEFAULT_SORT, isSortKey, parseBudget, SORT_KEYS, type SortKey, sortTors } from "@/lib/tor-sort";
import { useSavedTors } from "@/lib/use-saved-tors";
import { useSession } from "@/lib/use-session";
import type { TorRecord } from "@/types/tor";

import { BiddingBadge } from "./bidding-badge";
import { SaveSearchForm } from "./save-search-form";

import { AgencyFilter } from "./agency-filter";
import { FilterCheckbox } from "./filter-checkbox";
import { FilterRadio } from "./filter-radio";

/** Everything a reader can still act on: bid now, or comment on what is coming. */
const OPEN_STATUSES: readonly TorStatus[] = ["bidding", "comment"];

function statusOf(tor: TorRecord): TorStatus {
  const { status, reason } = biddingOf(tor);
  // Bid now, or plan for what is coming — two different jobs, so two options;
  // the "all open" shortcut puts them back together.
  // Only an invitation takes bids; a plan, a draft or a reference price is
  // still ahead of that.
  if (status === "open") return tor.stage === "ประกาศ TOR" ? "bidding" : "comment";
  if (status === "unknown") return "unknown";
  return reason === "awarded" || reason === "contracted" ? "awarded" : "closed";
}
const AMOUNT_LABEL = {
  budget: "budgetLabel",
  awarded: "awardedLabel",
  reference: "referencePriceLabel",
} as const satisfies Record<AmountKind, string>;
const PER_PAGE = 10;

/** A stable empty list, so the sorted results aren't recomputed on every render. */
const NO_PINS: string[] = [];

const SORT_LABEL_KEY: Record<SortKey, string> = {
  prepare: "sortPrepare",
  newest: "sortNewest",
  closing: "sortClosing",
  budget: "sortBudget",
};

/** Keeps the chosen order in the address, so a shared or reloaded link opens the same list. */
function rememberSort(key: SortKey) {
  const url = new URL(window.location.href);
  if (key === DEFAULT_SORT) url.searchParams.delete("sort");
  else url.searchParams.set("sort", key);
  window.history.replaceState(null, "", url);
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const t = useTranslations("PublicPage");
  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="shrink-0 font-medium">{t("sortLabel")}</span>
      <select
        value={value}
        onChange={(e) => {
          if (isSortKey(e.target.value)) onChange(e.target.value);
        }}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(SORT_LABEL_KEY[key])}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Bangkok time: an announcement made on 1 Jan local time is stored as 31 Dec UTC. */
const YEAR = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" });

/** The year an announcement was published, or null when the record carries no date. */
function announcedYear(createdAt: string): number | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : Number(YEAR.format(date));
}

/** Thai readers count in พ.ศ.; the ค.ศ. year is kept alongside for everyone else. */

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
 * A single pick among a fixed set of options, plus an explicit "any" that
 * resets to no filter — unlike CheckboxFilter's options, these are nested
 * windows (30 days within is a superset of 7), so picking more than one at
 * once wouldn't mean anything.
 */
function RadioFilter({
  name,
  title,
  anyLabel,
  options,
  selected,
  onChange,
}: {
  name: string;
  title: string;
  anyLabel: string;
  options: { id: string; label: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const row = (id: string | null, label: string) => (
    <label key={id ?? "any"} className="flex cursor-pointer items-start gap-3">
      <span className="mt-0.5">
        <FilterRadio name={name} checked={selected === id} onChange={() => onChange(id)} />
      </span>
      <span className="text-sm leading-snug text-ink-muted">{label}</span>
    </label>
  );

  return (
    <div className="mb-7">
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-2.5">
        {row(null, anyLabel)}
        {options.map((opt) => row(opt.id, opt.label))}
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

/**
 * `inApp`: rendered inside the signed-in shell, so a TOR opens there too.
 * `initialFilters` come from the address — a shared link, or an applied saved
 * search; `pinnedIds` lead whatever the sort.
 */
export function TorSearch({
  tors,
  inApp = false,
  initialFilters = NO_FILTERS,
  pinnedIds = NO_PINS,
}: {
  tors: TorRecord[];
  inApp?: boolean;
  initialFilters?: SearchFilters;
  pinnedIds?: string[];
}) {
  const [search, setSearch] = useState(initialFilters.query);
  const [sortKey, setSortKey] = useState<SortKey>(initialFilters.sort);
  const [selectedStatuses, setSelectedStatuses] = useState<TorStatus[]>(initialFilters.statuses);
  const [selectedDeadline, setSelectedDeadline] = useState<string | null>(initialFilters.deadline);
  const [selectedYears, setSelectedYears] = useState<number[]>(initialFilters.years);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(initialFilters.agencies);
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>(initialFilters.budgets);
  // Saving needs an account; a guest's list would have nowhere to live.
  const signedIn = Boolean(useSession());
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastQueryKey, setLastQueryKey] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { savedIds, toggleSaved } = useSavedTors();
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
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
  // Everything about a record that doesn't depend on the filters, worked out
  // once per list instead of on every keystroke for every record.
  const index = useMemo(
    () =>
      tors.map((tor) => ({
        tor,
        text: `${tor.title} ${tor.agency} ${tor.summary} ${tor.tags.join(" ")}`.toLowerCase(),
        budget: parseBudget(tor.budget),
        year: announcedYear(tor.createdAt),
      })),
    [tors],
  );
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const ranges = BUDGET_RANGES.filter((range) => selectedBudgets.includes(range.id));
    const statuses = new Set(selectedStatuses);
    const years = new Set(selectedYears);
    const agencies = new Set(selectedAgencies);

    return index
      .filter(
        ({ tor, text, budget, year }) =>
          (!q || text.includes(q)) &&
          (statuses.size === 0 || statuses.has(statusOf(tor))) &&
          matchesDeadline(tor, selectedDeadline) &&
          (years.size === 0 || (year !== null && years.has(year))) &&
          (agencies.size === 0 || agencies.has(tor.agency)) &&
          (ranges.length === 0 ||
            (budget !== null && ranges.some((range) => budget >= range.min && budget < range.max))),
      )
      .map(({ tor }) => tor);
  }, [index, deferredSearch, selectedStatuses, selectedDeadline, selectedYears, selectedAgencies, selectedBudgets]);

  const sorted = useMemo(() => sortTors(filtered, sortKey, pinnedIds), [filtered, sortKey, pinnedIds]);

  function changeSort(key: SortKey) {
    setSortKey(key);
    rememberSort(key);
  }

  // Any change to the query lands the reader back on the first page of results.
  const queryKey = JSON.stringify([
    search,
    selectedStatuses,
    selectedDeadline,
    selectedYears,
    selectedAgencies,
    selectedBudgets,
    sortKey,
  ]);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSubmitFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackOpenId(null);
    setFeedbackText("");
  }

  function clearAllFilters() {
    setSelectedStatuses([]);
    setSelectedDeadline(null);
    setSelectedYears([]);
    setSelectedAgencies([]);
    setSelectedBudgets([]);
    setSearch("");
  }

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedDeadline !== null ||
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

          <RadioFilter
            name="deadline-filter"
            title={t("filterDeadlineTitle")}
            anyLabel={t("deadlineAny")}
            options={DEADLINE_RANGES.map((r) => ({ id: r.id, label: t(r.labelKey) }))}
            selected={selectedDeadline}
            onChange={setSelectedDeadline}
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

          {signedIn && (hasActiveFilters || search.trim() !== "") && (
            <>
              <div className="my-7 h-px w-full bg-surface-alt" />
              <SaveSearchForm
                savedHref={inApp ? "/saved?scope=org" : "/saved"}
                filters={{
                  query: search.trim(),
                  sort: sortKey,
                  statuses: selectedStatuses,
                  deadline: selectedDeadline,
                  years: selectedYears,
                  agencies: selectedAgencies,
                  budgets: selectedBudgets,
                }}
              />
            </>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-5 flex items-center justify-end gap-4 lg:justify-between">
          <h2 className="hidden text-base font-semibold text-ink lg:block">
            {t.rich("resultsCount", {
              count: filtered.length,
              strong: (chunks) => <span className="text-ink">{chunks}</span>,
            })}
          </h2>
          {tors.length > 0 && <SortSelect value={sortKey} onChange={changeSort} />}
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
                isSaved={savedSet.has(tor.id)}
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

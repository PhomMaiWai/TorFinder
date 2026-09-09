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
import { useMemo, useState } from "react";

import { isKnown, stageBadgeCls } from "@/lib/tor-ui";
import { useSavedTors } from "@/lib/use-saved-tors";
import type { TorRecord } from "@/types/tor";

const STAGES = ["เปิดรับฟังความคิดเห็น", "ประกาศ TOR", "ประกาศผู้ชนะ"];
const PER_PAGE = 10;

const BUDGET_RANGES = [
  { id: "under-5m", labelKey: "budgetRangeUnder5m", min: 0, max: 5_000_000 },
  { id: "5m-10m", labelKey: "budgetRange5to10m", min: 5_000_000, max: 10_000_000 },
  { id: "10m-20m", labelKey: "budgetRange10to20m", min: 10_000_000, max: 20_000_000 },
  { id: "over-20m", labelKey: "budgetRangeOver20m", min: 20_000_000, max: Infinity },
] as const;

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
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mb-7">
      <h3 className="mb-3 text-sm font-bold text-zinc-900">{title}</h3>
      <div className="space-y-2.5">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5 flex items-center">
              <input
                type="checkbox"
                className="peer size-4 cursor-pointer appearance-none rounded border border-zinc-300 bg-white transition-all checked:border-accent checked:bg-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter((x) => x !== opt));
                }}
              />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
            </div>
            <span className="text-[13px] leading-snug text-zinc-600">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PublicTorCard({
  tor,
  isFeedbackOpen,
  feedbackText,
  onFeedbackChange,
  onToggleFeedback,
  onSubmitFeedback,
  isSaved,
  onToggleSave,
}: {
  tor: TorRecord;
  isFeedbackOpen: boolean;
  feedbackText: string;
  onFeedbackChange: (val: string) => void;
  onToggleFeedback: () => void;
  onSubmitFeedback: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const t = useTranslations("PublicPage");
  const isFeedbackStage = tor.stage === "เปิดรับฟังความคิดเห็น";
  const hasDeadline = isKnown(tor.deadline);
  const isUrgent = hasDeadline && tor.daysLeft <= 7;

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgb(24,24,27/6%)]">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${stageBadgeCls(tor.stage)}`}
            >
              {tor.stage}
            </span>
            {tor.budgetStatus === "สูงกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                <TrendingUp size={12} />
                {t("budgetHighBadge")}
              </span>
            )}
            {tor.budgetStatus === "ต่ำกว่าปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                <TrendingDown size={12} />
                {t("budgetLowBadge")}
              </span>
            )}
            {tor.budgetStatus === "ปกติ" && (
              <span className="flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                <CheckCircle2 size={12} />
                {t("budgetNormalBadge")}
              </span>
            )}
            {tor.hasVendorMismatch && (
              <span className="flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                <AlertTriangle size={12} />
                {t("vendorMismatchBadge")}
              </span>
            )}
            {tor.isNew && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                {t("newBadge")}
              </span>
            )}
            {isUrgent && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                <div className="size-1.5 animate-pulse rounded-full bg-red-500" />
                {t("urgentBadge")}
              </span>
            )}
          </div>

          <h3 className="text-[17px] font-bold text-zinc-900 sm:text-lg">{tor.title}</h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-zinc-400" />
              {tor.agency}
            </span>
            <span
              className={`flex items-center gap-1.5 ${isUrgent ? "font-medium text-red-600" : ""}`}
            >
              <Clock size={15} className={isUrgent ? "text-red-500" : "text-zinc-400"} />
              {hasDeadline ? t("daysLeftLabel", { days: tor.daysLeft }) : t("deadlineUnknown")}
            </span>
          </div>

          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-zinc-600">{tor.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {tor.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start justify-between border-t border-zinc-100 pt-5 sm:w-[220px] sm:items-end sm:border-none sm:pl-6 sm:pt-0">
          <div className="mb-4 flex w-full items-start justify-between gap-3 sm:mb-0 sm:flex-col sm:items-end">
            <div className="sm:text-right">
              <div className="mb-1 text-xs font-medium text-zinc-500">{t("budgetLabel")}</div>
              <div className="text-[17px] font-bold text-zinc-900">{tor.budget}</div>
            </div>
            <button
              onClick={onToggleSave}
              aria-label={isSaved ? t("unsaveAriaLabel") : t("saveAriaLabel")}
              className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors sm:mt-1 ${
                isSaved
                  ? "bg-accent-soft text-accent"
                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
              }`}
            >
              <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2 sm:mt-auto">
            {isFeedbackStage && (
              <button
                onClick={onToggleFeedback}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                <MessageSquare size={14} />
                {isFeedbackOpen ? t("closeFeedbackButton") : t("openFeedbackButton")}
              </button>
            )}
            <Link
              href={`/tor/${tor.id}`}
              className="flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
            >
              {t("viewDetails")}
            </Link>
            {/* e-GP occasionally publishes an announcement with an empty link, so
                only offer the document when there really is one to open. */}
            {tor.sourceUrl && (
              <a
                href={tor.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <ExternalLink size={14} />
                {t("announcementDocument")}
              </a>
            )}
          </div>
        </div>
      </div>

      {isFeedbackOpen && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 p-5 sm:p-6">
          <label className="mb-2 block text-sm font-semibold text-zinc-900">
            {t("feedbackFormLabel")}
          </label>
          <textarea
            className="w-full rounded-xl border border-zinc-200 bg-white p-3.5 text-sm text-zinc-800 shadow-sm outline-none placeholder:text-zinc-400 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            rows={3}
            value={feedbackText}
            onChange={(e) => onFeedbackChange(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">
              {t("feedbackDisclaimer")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onToggleFeedback}
                className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
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

export function TorSearch({ tors }: { tors: TorRecord[] }) {
  const [search, setSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([]);
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastQueryKey, setLastQueryKey] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { savedIds, toggleSaved } = useSavedTors();
  const t = useTranslations("PublicPage");

  // Filter options come from what was actually announced, not a fixed list.
  const agencies = useMemo(
    () => [...new Set(tors.map((t) => t.agency))].sort(),
    [tors],
  );
  const tags = useMemo(() => [...new Set(tors.flatMap((t) => t.tags))].sort(), [tors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tors.filter((tor) => {
      const matchSearch =
        !q ||
        `${tor.title} ${tor.agency} ${tor.summary} ${tor.tags.join(" ")}`
          .toLowerCase()
          .includes(q);
      const matchStage = selectedStages.length === 0 || selectedStages.includes(tor.stage);
      const matchAgency = selectedAgencies.length === 0 || selectedAgencies.includes(tor.agency);
      const matchTags = selectedTags.length === 0 || tor.tags.some((t) => selectedTags.includes(t));

      const budgetValue = parseBudget(tor.budget);
      const matchBudget =
        selectedBudgets.length === 0 ||
        (budgetValue !== null &&
          selectedBudgets.some((id) => {
            const range = BUDGET_RANGES.find((r) => r.id === id);
            return !!range && budgetValue >= range.min && budgetValue <= range.max;
          }));

      return matchSearch && matchStage && matchAgency && matchTags && matchBudget;
    });
  }, [tors, search, selectedStages, selectedAgencies, selectedTags, selectedBudgets]);

  // Any change to the query lands the reader back on the first page of results.
  const queryKey = JSON.stringify([
    search,
    selectedStages,
    selectedAgencies,
    selectedTags,
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
    setSelectedStages([]);
    setSelectedAgencies([]);
    setSelectedTags([]);
    setSelectedBudgets([]);
    setSearch("");
  }

  const hasActiveFilters =
    selectedStages.length > 0 ||
    selectedAgencies.length > 0 ||
    selectedTags.length > 0 ||
    selectedBudgets.length > 0;

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex w-full items-center justify-between lg:hidden">
        <span className="text-sm font-semibold text-zinc-800">
          {t("resultsCountMobile", { count: filtered.length })}
        </span>
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm"
        >
          <SlidersHorizontal size={16} />
          {t("filtersButton")}
        </button>
      </div>

      <aside
        className={`w-full shrink-0 lg:block lg:w-[280px] xl:w-[320px] ${
          showMobileFilters ? "block" : "hidden"
        }`}
      >
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <SlidersHorizontal size={18} /> {t("filtersButton")}
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[13px] font-medium text-accent hover:text-accent-dark"
              >
                {t("clearAllFilters")}
              </button>
            )}
          </div>

          <div className="mb-7">
            <label className="mb-3 block text-sm font-bold text-zinc-900">{t("searchLabel")}</label>
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchInputPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-[13px] text-zinc-900 outline-none transition-colors focus:border-accent/40 focus:bg-white focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div className="mb-7 h-px w-full bg-zinc-100" />

          <CheckboxFilter
            title={t("filterStageTitle")}
            options={STAGES}
            selected={selectedStages}
            onChange={setSelectedStages}
          />

          <div className="mb-7 h-px w-full bg-zinc-100" />

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

          <div className="mb-7 h-px w-full bg-zinc-100" />

          <CheckboxFilter
            title={t("filterAgencyTitle")}
            options={agencies}
            selected={selectedAgencies}
            onChange={setSelectedAgencies}
          />

          <div className="mb-7 h-px w-full bg-zinc-100" />

          <CheckboxFilter
            title={t("filterMethodTitle")}
            options={tags}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-5 hidden items-center justify-between lg:flex">
          <h2 className="text-[15px] font-semibold text-zinc-800">
            {t.rich("resultsCount", {
              count: filtered.length,
              strong: (chunks) => <span className="text-zinc-950">{chunks}</span>,
            })}
          </h2>
        </div>

        {tors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-24 text-center">
            <AlertTriangle size={32} className="mx-auto mb-4 text-zinc-300" />
            <h3 className="text-base font-semibold text-zinc-900">{t("noRecordsTitle")}</h3>
            <p className="mt-1 text-[15px] text-zinc-500">
              {t("noRecordsDescription")}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-24 text-center">
            <Search size={32} className="mx-auto mb-4 text-zinc-300" />
            <h3 className="text-base font-semibold text-zinc-900">{t("emptyStateTitle")}</h3>
            <p className="mt-1 text-[15px] text-zinc-500">{t("emptyStateDescription")}</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
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
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  {t("prevPage")}
                </button>
                <span className="text-sm text-zinc-500">
                  {t("pageIndicator", { page, total: pageCount })}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pageCount}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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

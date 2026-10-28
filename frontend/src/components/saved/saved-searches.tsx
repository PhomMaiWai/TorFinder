"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  cleanFilters,
  type SavedSearch,
  type SearchFilters,
  searchHref,
  STATUS_LABEL_KEY,
  yearLabel,
} from "@/lib/search-filters";
import { BUDGET_RANGES, DEADLINE_RANGES } from "@/lib/tor-ui";
import { useSession } from "@/lib/use-session";

/** Agencies past this many are counted, not listed — some searches pick dozens. */
const AGENCIES_SHOWN = 2;

/** What a saved search narrows by, as short chips in the search page's own words. */
function useFilterChips() {
  const t = useTranslations("PublicPage");
  const s = useTranslations("SavedPage");
  return (filters: SearchFilters): string[] => {
    const deadline = DEADLINE_RANGES.find((r) => r.id === filters.deadline);
    const agencies = filters.agencies.slice(0, AGENCIES_SHOWN);
    const moreAgencies = filters.agencies.length - agencies.length;
    return [
      ...(filters.query ? [`"${filters.query}"`] : []),
      ...filters.statuses.map((status) => t(STATUS_LABEL_KEY[status])),
      ...(deadline ? [t(deadline.labelKey)] : []),
      ...filters.years.map(yearLabel),
      ...BUDGET_RANGES.filter((r) => filters.budgets.includes(r.id)).map((r) => t(r.labelKey)),
      ...agencies,
      ...(moreAgencies > 0 ? [s("moreAgencies", { count: moreAgencies })] : []),
    ];
  };
}

/**
 * The account's saved searches: each one opens the search page with its
 * filters set, or can be deleted. Nothing shows for a guest, or while the
 * list is loading, so the saved TORs below don't jump.
 */
export function SavedSearches({ searchPath }: { searchPath: string }) {
  const t = useTranslations("SavedPage");
  const chipsOf = useFilterChips();
  const session = useSession();
  const [searches, setSearches] = useState<SavedSearch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch("/api/saved-searches", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((list: SavedSearch[]) => active && setSearches(list))
      .catch(() => active && setError(t("savedSearchesLoadFailed")));
    return () => {
      active = false;
    };
  }, [session, t]);

  async function remove(search: SavedSearch) {
    const before = searches;
    setSearches((list) => list?.filter((s) => s.id !== search.id) ?? null);
    setError(null);
    const res = await fetch(`/api/saved-searches/${search.id}`, { method: "DELETE" }).catch(() => null);
    // Already gone counts as done; anything else puts the row back.
    if (!res || (!res.ok && res.status !== 404)) {
      setSearches(before);
      setError(t("savedSearchDeleteFailed", { name: search.name }));
    }
  }

  if (!session || (searches === null && !error)) return null;

  return (
    <section className="mb-10" aria-labelledby="saved-searches-heading">
      <h2 id="saved-searches-heading" className="mb-4 text-lg font-bold text-ink">
        {t("savedSearchesTitle")}
      </h2>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {searches && searches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-ink-muted">
          {t("savedSearchesEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {searches?.map((search) => {
            const filters = cleanFilters(search.filters);
            const chips = chipsOf(filters);
            return (
              <li
                key={search.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                    <Search size={16} className="shrink-0 text-ink-subtle" />
                    <span className="truncate">{search.name}</span>
                  </h3>
                  {chips.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("savedSearchFiltersLabel")}>
                      {chips.map((chip) => (
                        <li key={chip} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-ink-muted">
                          {chip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={searchHref(searchPath, filters)}
                    className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
                  >
                    {t("applySearchCta")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(search)}
                    aria-label={t("deleteSearchAriaLabel", { name: search.name })}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-alt hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

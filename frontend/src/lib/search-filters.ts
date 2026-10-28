import { BUDGET_RANGES, DEADLINE_RANGES } from "@/lib/tor-ui";
import { DEFAULT_SORT, isSortKey, type SortKey } from "@/lib/tor-sort";

/**
 * One status a reader filters by, in the order they care: what they can still
 * act on first. It folds together three things that used to be separate
 * filters — whether bidding is open, the announcement stage, and the
 * announcement type — which said the same thing three ways.
 */
export type TorStatus = "bidding" | "comment" | "awarded" | "closed" | "unknown";

export const STATUSES: readonly TorStatus[] = ["bidding", "comment", "awarded", "closed", "unknown"];

/** Each status's label, under the search page's (PublicPage) messages. */
export const STATUS_LABEL_KEY: Record<TorStatus, string> = {
  bidding: "statusBidding",
  comment: "statusComment",
  awarded: "statusAwarded",
  closed: "statusClosed",
  unknown: "statusUnknown",
};

/** A Buddhist-era year with its Gregorian one, as the year filter shows it. */
export function yearLabel(year: number): string {
  return `${year + 543} (${year})`;
}

/**
 * Everything the search page can be narrowed by. The same shape is saved as a
 * saved search (the backend stores it as given) and written into the address,
 * so applying a saved search is only a link.
 */
export type SearchFilters = {
  query: string;
  sort: SortKey;
  statuses: TorStatus[];
  deadline: string | null;
  years: number[];
  agencies: string[];
  budgets: string[];
};

export const NO_FILTERS: SearchFilters = {
  query: "",
  sort: DEFAULT_SORT,
  statuses: [],
  deadline: null,
  years: [],
  agencies: [],
  budgets: [],
};

export type SavedSearch = {
  id: string;
  name: string;
  /** As stored: older or hand-made rows may lack fields or carry ids that no longer exist. */
  filters: Partial<Record<keyof SearchFilters, unknown>>;
  createdAt: string;
};

const isStatus = (value: unknown): value is TorStatus => STATUSES.includes(value as TorStatus);
const isDeadline = (value: unknown): value is string => DEADLINE_RANGES.some((r) => r.id === value);
const isBudget = (value: unknown): value is string => BUDGET_RANGES.some((r) => r.id === value);
const isYear = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 1900;
const strings = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Whatever came in — a saved row, or the address — reduced to filters the page
 * knows. Anything it doesn't know is dropped rather than shown as a filter
 * that matches nothing.
 */
export function cleanFilters(raw: Partial<Record<keyof SearchFilters, unknown>>): SearchFilters {
  return {
    query: typeof raw.query === "string" ? raw.query.trim() : "",
    sort: isSortKey(raw.sort) ? raw.sort : DEFAULT_SORT,
    statuses: strings(raw.statuses).filter(isStatus),
    deadline: isDeadline(raw.deadline) ? raw.deadline : null,
    years: strings(raw.years).map(Number).filter(isYear),
    agencies: strings(raw.agencies).filter((a): a is string => typeof a === "string" && a.length > 0),
    budgets: strings(raw.budgets).filter(isBudget),
  };
}

export function hasFilters(filters: SearchFilters): boolean {
  return (
    filters.query !== "" ||
    filters.statuses.length > 0 ||
    filters.deadline !== null ||
    filters.years.length > 0 ||
    filters.agencies.length > 0 ||
    filters.budgets.length > 0
  );
}

type Params = { [key: string]: string | string[] | undefined };

const all = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Lists go as repeated keys — an agency's name can have a comma in it. */
export function filtersFromParams(params: Params): SearchFilters {
  return cleanFilters({
    query: all(params.q)[0],
    sort: all(params.sort)[0],
    statuses: all(params.status),
    deadline: all(params.deadline)[0],
    years: all(params.year),
    agencies: all(params.agency),
    budgets: all(params.budget),
  });
}

/** The address of the search page with these filters set; the default sort is left out. */
export function searchHref(path: string, filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  filters.statuses.forEach((s) => params.append("status", s));
  if (filters.deadline) params.set("deadline", filters.deadline);
  filters.years.forEach((y) => params.append("year", String(y)));
  filters.agencies.forEach((a) => params.append("agency", a));
  filters.budgets.forEach((b) => params.append("budget", b));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

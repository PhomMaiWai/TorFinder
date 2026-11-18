import type { Locale } from "@/i18n/config";

/**
 * Dates in the reader's language. Thai uses the Buddhist era a Thai reader
 * expects — `th-TH` does that conversion itself, so nothing here does
 * arithmetic on years — and English uses day-month-year. Always Bangkok time:
 * every deadline and log line is about events in Thailand.
 */
const LOCALE_TAG: Record<Locale, string> = { th: "th-TH", en: "en-GB" };
const TIME_ZONE = "Asia/Bangkok";

function valid(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "16 ก.ย. 2569 22:05" / "16 Sept 2026, 22:05" — a log line needs the time, not just the day. */
export function formatDateTime(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleString(LOCALE_TAG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

/** "16 ก.ย. 2569" / "16 Sept 2026", or with `month: "long"` the full month name; null for a missing or invalid date. */
export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  month: "short" | "long" = "short",
): string | null {
  const date = valid(value);
  return date
    ? date.toLocaleDateString(LOCALE_TAG[locale], { day: "numeric", month, year: "numeric", timeZone: TIME_ZONE })
    : null;
}

/** "16 ก.ย." / "16 Sept" — for a date the reader knows is close, the year is noise. */
export function formatDayMonth(value: string | Date | null | undefined, locale: Locale): string | null {
  const date = valid(value);
  return date ? date.toLocaleDateString(LOCALE_TAG[locale], { day: "numeric", month: "short", timeZone: TIME_ZONE }) : null;
}

const MINUTE = 60_000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", MINUTE],
  ["hour", 60 * MINUTE],
  ["day", 24 * 60 * MINUTE],
];

/**
 * "2 นาทีที่แล้ว" / "2 minutes ago". Anything older than a day is given as a
 * date instead: at that distance a reader wants to know when, not how long ago.
 */
export function timeAgo(value: string | Date, locale: Locale): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed >= 24 * 60 * MINUTE) return formatDate(value, locale) ?? "";

  const format = new Intl.RelativeTimeFormat(LOCALE_TAG[locale], { numeric: "auto" });
  const [unit, ms] = [...UNITS].reverse().find(([, size]) => elapsed >= size) ?? UNITS[0];
  return format.format(-Math.floor(elapsed / ms), unit);
}

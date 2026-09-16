/**
 * Every source publishes the same facts in its own dialect: baht as a number,
 * a string or a Thai-numeral string; dates as ISO, as `/Date(ms)/`, or as
 * "24 ก.ย. 69". Each one is turned into the single form the database stores
 * here, so no importer invents its own spelling of "ไม่ระบุ".
 */

/** What every source writes when a fact simply wasn't published. */
export const UNKNOWN = "ไม่ระบุ";

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/**
 * MEA files many announcements with Thai numerals ("๒๘,๐๐๐ อัน") for the same
 * projects e-GP files with Arabic ones. Folding them makes the two comparable
 * without touching what a reader sees — only matching and parsing use this.
 */
export function foldThaiDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

/** Collapses the whitespace and stray newlines that HTML and CSV alike carry in. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function formatBaht(amount: number | null | undefined): string {
  return amount && amount > 0 ? BAHT.format(amount) : UNKNOWN;
}

/**
 * ASP.NET serializes dates as `/Date(1789491600000)/`; CKAN and e-GP use ISO.
 * Anything unparseable becomes null rather than an Invalid Date that would
 * survive all the way into a listing.
 */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const dotNet = typeof value === "string" && /^\/Date\((-?\d+)\)\/$/.exec(value);
  const date = dotNet ? new Date(Number(dotNet[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days from now until `date`, floored at 0 — a closed announcement is 0, never negative. */
export function daysUntil(date: Date | null): number {
  if (!date) return 0;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return Math.max(days, 0);
}

/** The deadline as a reader sees it, e.g. "24 ก.ย. 2569". */
export function formatThaiDate(date: Date | null): string {
  if (!date) return UNKNOWN;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The e-GP project number an announcement belongs to, wherever its source
 * keeps it: a column of its own, or appended to the announcement number as
 * "… เลขที่โครงการในระบบ e-GP : 69089649017". It is the only identifier the
 * three portals share, which is what makes cross-source matching exact rather
 * than a guess — so it is worth digging out of free text.
 */
export function extractProjectNumber(...candidates: (string | number | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    const text = foldThaiDigits(String(candidate));
    // e-GP project numbers are 11 digits; a shorter run is a quantity or a year.
    const match = /\b(\d{11,})\b/.exec(text);
    if (match) return match[1];
  }
  return undefined;
}

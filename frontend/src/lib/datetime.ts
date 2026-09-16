/**
 * Dates as the admin pages show them. Thai locale throughout, which also means
 * the Buddhist era a Thai reader expects — `toLocaleDateString("th-TH")` does
 * that conversion itself, so nothing here does arithmetic on years.
 */

/** "16 ก.ย. 2569 22:05" — a log line needs the time, not just the day. */
export function thaiDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function thaiDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MINUTE = 60_000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", MINUTE],
  ["hour", 60 * MINUTE],
  ["day", 24 * 60 * MINUTE],
];

/**
 * "2 นาทีที่แล้ว". Anything older than a day is given as a date instead: at
 * that distance a reader wants to know when, not how long ago.
 */
export function timeAgo(value: string | Date): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed >= 24 * 60 * MINUTE) return thaiDate(value);

  const format = new Intl.RelativeTimeFormat("th-TH", { numeric: "auto" });
  const [unit, ms] = [...UNITS].reverse().find(([, size]) => elapsed >= size) ?? UNITS[0];
  return format.format(-Math.floor(elapsed / ms), unit);
}

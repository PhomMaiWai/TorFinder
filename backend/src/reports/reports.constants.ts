/**
 * What is wrong with an announcement, as the person reporting it picks it. Ids,
 * not Thai labels: the form words them, and the admin list filters by them.
 */
export const REPORT_REASONS = [
  /** A figure or date on the record is wrong: budget, deadline, agency, stage. */
  "wrong-info",
  /** It isn't software work and shouldn't be listed (FR-22's classification override). */
  "not-software",
  /** A document or the source page doesn't open. */
  "broken-link",
  /** The same project is listed twice. */
  "duplicate",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Open until an admin has dealt with it; resolving it is #163's admin list. */
export const REPORT_STATUSES = ["open", "resolved"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

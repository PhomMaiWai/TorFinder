/** What can be wrong with an announcement. Mirrors backend/src/reports/reports.constants.ts. */
export const REPORT_REASONS = ["wrong-info", "not-software", "broken-link", "duplicate", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const isReportReason = (value: string): value is ReportReason =>
  (REPORT_REASONS as readonly string[]).includes(value);

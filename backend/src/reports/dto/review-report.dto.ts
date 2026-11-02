import { IsBoolean, IsIn, IsOptional } from "class-validator";

import { REPORT_STATUSES, ReportStatus } from "../reports.constants";

export class ReviewReportDto {
  /** "resolved" once an admin has dealt with it; "open" puts it back on the list. */
  @IsIn(REPORT_STATUSES)
  status!: ReportStatus;

  /**
   * Resolved by correcting the TOR through "Fix this TOR" (#227), rather than
   * closed as not needing a change — the audit log says which.
   */
  @IsOptional()
  @IsBoolean()
  fixed?: boolean;
}

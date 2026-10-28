import { IsIn } from "class-validator";

import { REPORT_STATUSES, ReportStatus } from "../reports.constants";

export class ReviewReportDto {
  /** "resolved" once an admin has dealt with it; "open" puts it back on the list. */
  @IsIn(REPORT_STATUSES)
  status!: ReportStatus;
}

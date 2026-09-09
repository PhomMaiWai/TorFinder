import { IsIn, IsOptional } from "class-validator";

import { FEEDBACK_STATUSES, FeedbackStatus } from "../feedback.constants";

export class FeedbackQueryDto {
  /** Omitted means "everything", which only the moderation views ask for. */
  @IsOptional()
  @IsIn(FEEDBACK_STATUSES)
  status?: FeedbackStatus;
}

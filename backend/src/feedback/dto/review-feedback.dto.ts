import { IsIn } from "class-validator";

import { FEEDBACK_STATUSES, FeedbackStatus } from "../feedback.constants";

export class ReviewFeedbackDto {
  @IsIn(FEEDBACK_STATUSES, { message: "สถานะไม่ถูกต้อง" })
  status!: FeedbackStatus;
}

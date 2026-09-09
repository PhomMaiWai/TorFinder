import { IsIn } from "class-validator";

/** Reviewing decides the outcome, so "pending" is not a valid target here. */
export const REVIEW_DECISIONS = ["approved", "rejected"] as const;

export class ReviewAccountDto {
  @IsIn(REVIEW_DECISIONS)
  status!: (typeof REVIEW_DECISIONS)[number];
}

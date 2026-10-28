import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

/** The tabs the auditor's list can be narrowed to; omitted means every flagged reason. */
export const FLAGGED_TOR_FILTERS = ["budget-high", "budget-low", "competition"] as const;

export class ListFlaggedTorQueryDto {
  @IsOptional()
  @IsIn(FLAGGED_TOR_FILTERS)
  flag?: (typeof FLAGGED_TOR_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

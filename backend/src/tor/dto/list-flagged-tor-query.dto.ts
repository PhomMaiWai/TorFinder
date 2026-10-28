import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import { TOR_BUDGET_FLAGS } from "../tor.constants";

export class ListFlaggedTorQueryDto {
  /** Omitted means both flagged reasons — high and low. */
  @IsOptional()
  @IsIn(TOR_BUDGET_FLAGS)
  budgetStatus?: (typeof TOR_BUDGET_FLAGS)[number];

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

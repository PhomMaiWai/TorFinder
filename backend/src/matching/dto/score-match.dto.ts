import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { CERTIFICATION_KEYS, Certification } from "../requirements";
import { WORK_TYPE_KEYS, WorkType } from "../work-types";

/** A company profile to score, for callers that aren't a stored account. */
export class ScoreMatchDto {
  @IsString()
  @MinLength(1, { message: "กรุณาระบุชื่อบริษัท" })
  @MaxLength(200)
  companyName!: string;

  @IsIn(WORK_TYPE_KEYS, { each: true })
  workTypes: WorkType[] = [];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  largestPastContract?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  registeredCapital?: number;

  @IsOptional()
  @IsIn(CERTIFICATION_KEYS, { each: true })
  certifications?: Certification[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  preferredBudgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  preferredBudgetMax?: number;
}

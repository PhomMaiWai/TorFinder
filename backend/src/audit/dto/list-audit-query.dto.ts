import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

/** A calendar day as a date input sends it; read as a day in Bangkok. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ListAuditQueryDto {
  /** One action label exactly, as the feed lists them. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  action?: string;

  /** Part of who did it — an admin's email, or the sync bot. Any case. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  actor?: string;

  /** First day included. */
  @IsOptional()
  @Matches(DAY, { message: "from ต้องอยู่ในรูปแบบ YYYY-MM-DD" })
  from?: string;

  /** Last day included. */
  @IsOptional()
  @Matches(DAY, { message: "to ต้องอยู่ในรูปแบบ YYYY-MM-DD" })
  to?: string;

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

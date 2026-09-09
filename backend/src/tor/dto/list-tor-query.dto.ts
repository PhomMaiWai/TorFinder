import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const TOR_SOURCES = ["manual", "egp"] as const;
export type TorSource = (typeof TOR_SOURCES)[number];

export class ListTorQueryDto {
  /** Omitted means both admin-entered and imported records. */
  @IsOptional()
  @IsIn(TOR_SOURCES)
  source?: TorSource;

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

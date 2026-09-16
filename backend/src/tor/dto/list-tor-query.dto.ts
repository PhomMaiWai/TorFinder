import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import { TOR_IMPORT_SOURCES } from "../tor.constants";

/** "manual" is what an admin typed in; the rest are the portals we import from. */
export const TOR_SOURCES = ["manual", ...TOR_IMPORT_SOURCES] as const;
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

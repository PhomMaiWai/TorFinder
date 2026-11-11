import { Type } from "class-transformer";
import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { SIMILAR } from "../similar.constants";

/** Either `text` or `torId` — SimilarService refuses both or neither. */
export class FindSimilarDto {
  /** A past project, a company profile, or any description of the work. */
  @IsOptional()
  @IsString()
  @MaxLength(SIMILAR.maxQueryChars, { message: `ข้อความยาวเกิน ${SIMILAR.maxQueryChars.toLocaleString()} ตัวอักษร` })
  text?: string;

  /** A TOR to find others like. */
  @IsOptional()
  @IsMongoId({ message: "รหัส TOR ไม่ถูกต้อง" })
  torId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SIMILAR.maxLimit)
  limit?: number;
}

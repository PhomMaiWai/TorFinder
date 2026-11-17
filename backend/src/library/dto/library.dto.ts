import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

import { CERTIFICATION_KEYS, Certification } from "../../matching/requirements";
import { WORK_TYPE_KEYS, WorkType } from "../../matching/work-types";
import { CLIENT_TYPES, ClientType } from "../library.types";

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_MESSAGE = "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD";

/** A blank text box means "not given", not an empty string worth storing. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === "string" ? (value.trim() === "" ? undefined : value.trim()) : value;

/** A blank number box comes as "" or null; neither is a 0. */
const blankNumber = ({ value }: { value: unknown }) => (value === "" || value === null ? undefined : value);

/** Saving replaces the record's fields as a whole: one left out is cleared. */
export class PastProjectDto {
  @Transform(blankToUndefined)
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อโครงการ" })
  @MaxLength(300)
  title!: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  client?: string;

  @IsOptional()
  @IsIn(CLIENT_TYPES)
  clientType?: ClientType;

  @Transform(blankNumber)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  value?: number;

  @Transform(blankToUndefined)
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  startedAt?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  completedAt?: string;

  @IsOptional()
  @IsIn(WORK_TYPE_KEYS, { each: true })
  workTypes?: WorkType[];

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class TeamMemberDto {
  @Transform(blankToUndefined)
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อ" })
  @MaxLength(200)
  name!: string;

  @Transform(blankToUndefined)
  @IsString()
  @MinLength(1, { message: "กรุณากรอกตำแหน่ง" })
  @MaxLength(200)
  position!: string;

  @Transform(blankNumber)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  education?: string;

  @IsOptional()
  @IsIn(CERTIFICATION_KEYS, { each: true })
  certifications?: Certification[];

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  skills?: string;
}

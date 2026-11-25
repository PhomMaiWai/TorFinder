import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/** ISO calendar date, the form the extraction stores dates in. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "HH:MM" or a window "HH:MM–HH:MM" (an en dash or a hyphen). */
const TIME_WINDOW = /^\d{2}:\d{2}([–-]\d{2}:\d{2})?$/;

const LIST_MAX_ITEMS = 50;
const LIST_ITEM_MAX = 1_000;
const TEXT_MAX = 2_000;

/**
 * An admin's review of what the AI read off a TOR's document. Every field is
 * optional — only those sent are compared, and only those that differ are
 * written. `null` clears a single-value field; an empty array clears a list.
 * `reviewed: true` with nothing changed records that the admin checked the
 * reading and found it right.
 */
export class UpdateExtractionDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5_000)
  scope?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  qualifications?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  deliverables?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  paymentTerms?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  budgetAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  referencePrice?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_DATE, { message: "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD" })
  deadline?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_WINDOW, { message: "เวลาต้องอยู่ในรูปแบบ HH:MM หรือ HH:MM–HH:MM" })
  deadlineTime?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_DATE, { message: "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD" })
  feedbackDeadline?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  contractPeriod?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  evaluationCriteria?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  bidSecurity?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  penalty?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  warrantyPeriod?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TEXT_MAX)
  contact?: string | null;

  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;
}

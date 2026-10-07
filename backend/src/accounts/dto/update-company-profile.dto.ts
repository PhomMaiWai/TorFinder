import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { CERTIFICATION_KEYS, Certification } from "../../matching/requirements";
import { WORK_TYPE_KEYS, WorkType } from "../../matching/work-types";

import { IsThaiTaxId } from "../../common/thai-id";

/**
 * companyName/taxId are set at signup and stay fixed from then on — except a
 * Google sign-in never collects them, so the service layer allows a one-time
 * fill for whichever of the two is still blank, then locks it just the same.
 * email is never editable here at all; it's account identity, not a company
 * field.
 */
export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อบริษัท" })
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsThaiTaxId()
  taxId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsString()
  pastExperience?: string;

  @IsOptional()
  @IsIn(WORK_TYPE_KEYS, { each: true })
  workTypes?: WorkType[];

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

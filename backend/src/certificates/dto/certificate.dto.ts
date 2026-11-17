import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

import { CERTIFICATION_KEYS, Certification } from "../../matching/requirements";

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_MESSAGE = "วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD";

/** A blank text box means "not given", not an empty string worth storing. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? undefined : typeof value === "string" ? value.trim() : value;

/**
 * Every editable field of one certificate. Saving replaces the record's fields
 * as a whole, so a field left out is cleared — the form always sends them all.
 */
export class CertificateDto {
  @Transform(blankToUndefined)
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อใบรับรอง" })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(CERTIFICATION_KEYS)
  standard?: Certification;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuer?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  issuedAt?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  expiresAt?: string;

  /** Opened by whoever reads the bid, so only a real web address — never javascript: or data:. */
  @Transform(blankToUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ["https", "http"], require_protocol: true, require_tld: true },
    { message: "ลิงก์ตรวจสอบต้องขึ้นต้นด้วย https:// หรือ http://" },
  )
  @MaxLength(500)
  verifyUrl?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  scope?: string;
}

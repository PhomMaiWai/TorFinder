import { IsString, MaxLength, MinLength } from "class-validator";

import { IsThaiPhone, IsThaiTaxId } from "../../common/thai-id";

/**
 * Google sign-in verifies identity but never collects company info, so a
 * brand-new Google account is held (see AuthService.googleAuth) until the
 * caller fills in the same fields the regular signup form requires.
 */
export class GoogleCompleteSignupDto {
  @IsString()
  @MinLength(1, { message: "credential is required" })
  credential!: string;

  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อบริษัท" })
  @MaxLength(200)
  companyName!: string;

  @IsThaiTaxId()
  taxId!: string;

  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อผู้ติดต่อ" })
  @MaxLength(200)
  contactName!: string;

  @IsThaiPhone()
  phone!: string;

  @IsString()
  @MaxLength(500)
  address = "";

  @IsString()
  @MaxLength(200)
  specialty = "";

  @IsString()
  @MaxLength(50)
  size = "";
}

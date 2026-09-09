import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import { IsThaiPhone, IsThaiTaxId } from "../../common/thai-id";

export class SignupDto {
  @IsEmail({}, { message: "อีเมลไม่ถูกต้อง" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" })
  @MaxLength(128)
  password!: string;

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

import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

/** A link's token: 32 random bytes in base64url is 43 characters. */
class LinkTokenDto {
  @IsString()
  @MinLength(20, { message: "ลิงก์ไม่ถูกต้อง" })
  @MaxLength(200, { message: "ลิงก์ไม่ถูกต้อง" })
  token!: string;
}

export class EmailOnlyDto {
  @IsEmail({}, { message: "อีเมลไม่ถูกต้อง" })
  email!: string;
}

export class ResetPasswordDto extends LinkTokenDto {
  // Same rule as sign-up.
  @IsString()
  @MinLength(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" })
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto extends LinkTokenDto {}

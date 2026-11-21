import { IsString, MaxLength, MinLength } from "class-validator";

/** ASVS 6.2.3: changing a password takes the current one as well as the new one. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: "กรุณากรอกรหัสผ่านปัจจุบัน" })
  @MaxLength(128)
  currentPassword!: string;

  // Same rule as sign-up and reset.
  @IsString()
  @MinLength(12, { message: "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร" })
  @MaxLength(128)
  newPassword!: string;
}

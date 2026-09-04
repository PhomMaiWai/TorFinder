import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "อีเมลไม่ถูกต้อง" })
  email!: string;

  @IsString()
  @MinLength(1, { message: "กรุณากรอกรหัสผ่าน" })
  password!: string;
}

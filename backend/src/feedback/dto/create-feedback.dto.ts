import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateFeedbackDto {
  @IsString()
  @MinLength(10, { message: "กรุณาเขียนความคิดเห็นอย่างน้อย 10 ตัวอักษร" })
  @MaxLength(5000, { message: "ความคิดเห็นยาวเกินกำหนด" })
  text!: string;

  /** Anonymous comments are allowed; the display name falls back server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;
}

import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { REPORT_REASONS, ReportReason } from "../reports.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateReportDto {
  @IsIn(REPORT_REASONS, { message: "กรุณาเลือกประเภทของปัญหา" })
  reason!: ReportReason;

  /** What is wrong, in the reporter's words — enough for an admin to check it. */
  @Transform(trim)
  @IsString()
  @MinLength(10, { message: "กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร" })
  @MaxLength(2000, { message: "คำอธิบายยาวเกินกำหนด" })
  message!: string;

  /** A guest's way to be reached about it; a signed-in reporter is known from the session. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  contact?: string;
}

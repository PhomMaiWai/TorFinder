import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

import { TOR_BUDGET_STATUSES, TOR_STAGES } from "../tor.constants";

export class UpdateTorDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อโครงการ" })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณาเลือกหน่วยงาน" })
  agency?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณากรอกงบประมาณ" })
  budget?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณากรอกวันที่ปิดรับ" })
  deadline?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  daysLeft?: number;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(TOR_STAGES)
  stage?: (typeof TOR_STAGES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "กรุณากรอกรายละเอียดโดยย่อ" })
  summary?: string;

  @IsOptional()
  @IsIn(TOR_BUDGET_STATUSES)
  budgetStatus?: (typeof TOR_BUDGET_STATUSES)[number];
}

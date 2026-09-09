import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

import { TOR_BUDGET_STATUSES, TOR_STAGES } from "../tor.constants";

export class CreateTorDto {
  @IsString()
  @MinLength(1, { message: "กรุณากรอกชื่อโครงการ" })
  title!: string;

  @IsString()
  @MinLength(1, { message: "กรุณาเลือกหน่วยงาน" })
  agency!: string;

  @IsString()
  @MinLength(1, { message: "กรุณากรอกงบประมาณ" })
  budget!: string;

  @IsString()
  @MinLength(1, { message: "กรุณากรอกวันที่ปิดรับ" })
  deadline!: string;

  @IsInt()
  @Min(0)
  daysLeft!: number;

  @IsString({ each: true })
  tags!: string[];

  @IsIn(TOR_STAGES)
  stage!: (typeof TOR_STAGES)[number];

  @IsString()
  @MinLength(1, { message: "กรุณากรอกรายละเอียดโดยย่อ" })
  summary!: string;

  @IsOptional()
  @IsIn(TOR_BUDGET_STATUSES)
  budgetStatus?: (typeof TOR_BUDGET_STATUSES)[number];
}

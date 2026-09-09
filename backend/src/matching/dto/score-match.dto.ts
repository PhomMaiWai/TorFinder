import { IsString, MaxLength, MinLength } from "class-validator";

/** A company profile to score, for callers that aren't a stored account. */
export class ScoreMatchDto {
  @IsString()
  @MinLength(1, { message: "กรุณาระบุชื่อบริษัท" })
  @MaxLength(200)
  companyName!: string;

  @IsString()
  @MaxLength(200)
  specialty = "";

  @IsString()
  @MaxLength(50)
  size = "";
}

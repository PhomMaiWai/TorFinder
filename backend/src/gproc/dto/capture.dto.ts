import { ArrayMaxSize, ArrayNotEmpty, IsArray, Matches } from "class-validator";

import { GPROC_REQUEST, PROJECT_NUMBER } from "../gproc.constants";

export class CaptureDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(GPROC_REQUEST.maxPerCapture)
  @Matches(PROJECT_NUMBER, { each: true, message: "เลขที่โครงการต้องเป็นตัวเลข 11 หลัก" })
  projectNumbers!: string[];
}

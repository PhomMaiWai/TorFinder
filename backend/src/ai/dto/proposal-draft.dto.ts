import { IsString, MaxLength, MinLength } from "class-validator";

import { MAX_PREVIOUS_PROPOSAL } from "../proposal-draft";

export class ProposalDraftDto {
  @IsString()
  @MinLength(200, { message: "ข้อเสนอเดิมสั้นเกินไป กรุณาวางเนื้อหาอย่างน้อย 200 ตัวอักษร" })
  @MaxLength(MAX_PREVIOUS_PROPOSAL, { message: "ข้อเสนอเดิมยาวเกิน 20,000 ตัวอักษร" })
  previousProposal!: string;
}

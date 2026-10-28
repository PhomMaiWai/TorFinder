import { IsMongoId, ValidateIf } from "class-validator";

export class SetTorOwnerDto {
  /** The owner account to link; `null` unlinks the announcement from anyone. */
  @ValidateIf((dto: SetTorOwnerDto) => dto.ownerId !== null)
  @IsMongoId({ message: "รหัสบัญชีเจ้าของโครงการไม่ถูกต้อง" })
  ownerId!: string | null;
}

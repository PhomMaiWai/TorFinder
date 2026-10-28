import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Length } from "class-validator";

/**
 * Roles an admin may move an account between. `org` is out on both sides: an
 * organization carries a company profile and an approval that only its own
 * sign-up creates, so it can't be made from (or turned into) another role.
 */
export const EDITABLE_ROLES = ["admin", "owner", "auditor", "viewer"] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsIn(EDITABLE_ROLES)
  role?: EditableRole;
}

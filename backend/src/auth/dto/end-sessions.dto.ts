import { IsOptional, IsString, MaxLength } from "class-validator";

/** The current password, when the account has one: ending sessions needs authentication again (ASVS 7.5.2). */
export class EndSessionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}

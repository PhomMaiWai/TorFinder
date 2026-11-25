import { IsBoolean, IsOptional } from "class-validator";

/**
 * Omitting a field leaves it as it was. LINE has its own link/unlink routes —
 * a pasted id is never accepted.
 */
export class UpdateChannelsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

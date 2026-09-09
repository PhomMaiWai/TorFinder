import { IsIn, IsOptional } from "class-validator";

import { ACCOUNT_STATUSES, AccountStatus } from "../../database/database.service";

export class AccountQueryDto {
  /** Omitted lists every organization account. */
  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: AccountStatus;
}

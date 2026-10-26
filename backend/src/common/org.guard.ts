import { Injectable } from "@nestjs/common";

import { RoleGuard } from "./role.guard";

/** A bidding company. Keeps paid, company-specific work (like AI drafts) away from public viewers. */
@Injectable()
export class OrgGuard extends RoleGuard {
  protected readonly roles = ["org"] as const;
  protected readonly refusal = "ฟีเจอร์นี้สำหรับบัญชีบริษัทเท่านั้น";
}

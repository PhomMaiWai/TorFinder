import { Injectable } from "@nestjs/common";

import { RoleGuard } from "./role.guard";

/** The agency side of an announcement. Admins are not owners: an owner route answers for the caller's own TORs. */
@Injectable()
export class OwnerGuard extends RoleGuard {
  protected readonly roles = ["owner"] as const;
  protected readonly refusal = "ต้องเข้าสู่ระบบด้วยบัญชีเจ้าของโครงการ";
}

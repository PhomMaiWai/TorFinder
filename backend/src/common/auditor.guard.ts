import { Injectable } from "@nestjs/common";

import { RoleGuard } from "./role.guard";

/** The Auditor Office, reviewing flagged announcements. */
@Injectable()
export class AuditorGuard extends RoleGuard {
  protected readonly roles = ["auditor"] as const;
  protected readonly refusal = "ต้องเข้าสู่ระบบด้วยบัญชีผู้ตรวจสอบ";
}

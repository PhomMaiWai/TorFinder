import { Injectable } from "@nestjs/common";

import { RoleGuard } from "./role.guard";

/** Approving an account is privileged, so the caller must be a logged-in admin. */
@Injectable()
export class AdminGuard extends RoleGuard {
  protected readonly roles = ["admin"] as const;
  protected readonly refusal = "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ";
}

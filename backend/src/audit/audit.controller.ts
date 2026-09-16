import { Controller, Get, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** The admin dashboard's audit log: recent admin actions + e-GP sync runs, newest first. */
  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.audit.findAll();
  }
}

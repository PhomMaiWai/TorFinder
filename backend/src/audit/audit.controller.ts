import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { AuditService } from "./audit.service";
import { ListAuditQueryDto } from "./dto/list-audit-query.dto";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * The admin's audit log: admin actions and e-GP sync runs, newest first, a
   * page at a time, narrowed by action, actor and day.
   */
  @Get()
  @UseGuards(AdminGuard)
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }
}

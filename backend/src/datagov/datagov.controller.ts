import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";

import { AuditService, importDetail } from "../audit/audit.service";
import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { DataGovService } from "./datagov.service";

@Controller("datagov")
export class DataGovController {
  constructor(
    private readonly dataGovService: DataGovService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Starting an import is privileged: it spends the portal's patience and
   * rewrites what every visitor sees, so it takes an admin session.
   */
  @Post("sync")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async sync(@Req() request: AuthenticatedRequest) {
    const result = await this.dataGovService.sync();
    await this.audit.record(request.session.email, "สั่งซิงค์ข้อมูล data.go.th", importDetail(result));
    return result;
  }
}

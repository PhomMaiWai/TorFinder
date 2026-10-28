import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";

import { AuditService, importDetail } from "../audit/audit.service";
import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { MeaService } from "./mea.service";

@Controller("mea")
export class MeaController {
  constructor(
    private readonly meaService: MeaService,
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
    const result = await this.meaService.sync();
    await this.audit.record(request.session.email, "สั่งซิงค์ข้อมูล กฟน.", importDetail(result));
    return result;
  }
}

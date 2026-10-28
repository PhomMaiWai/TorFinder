import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";

import { AuditService, importDetail } from "../audit/audit.service";
import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { EgpService } from "./egp.service";

@Controller("egp")
export class EgpController {
  constructor(
    private readonly egpService: EgpService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Starting an import is privileged: it spends the portal's patience and
   * rewrites what every visitor sees, so it takes an admin session. The run
   * itself is logged as a sync run; this entry says who asked for it.
   */
  @Post("sync")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async sync(@Req() request: AuthenticatedRequest) {
    const result = await this.egpService.sync();
    await this.audit.record(request.session.email, "สั่งซิงค์ข้อมูล e-GP", importDetail(result));
    return result;
  }

  /**
   * Titles the software filter turned down that still read like IT work, from
   * the latest sync — where a wrongly rejected tender would be.
   */
  @Get("near-misses")
  @UseGuards(AdminGuard)
  nearMisses() {
    return this.egpService.nearMisses();
  }

  /** Sync counts and success/fail history for the admin dashboard's pipeline card. */
  @Get("metrics")
  @UseGuards(AdminGuard)
  metrics() {
    return this.egpService.metrics();
  }
}

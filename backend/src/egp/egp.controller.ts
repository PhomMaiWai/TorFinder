import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { EgpService } from "./egp.service";

@Controller("egp")
export class EgpController {
  constructor(private readonly egpService: EgpService) {}

  /**
   * Starting an import is privileged: it spends the portal's patience and
   * rewrites what every visitor sees, so it takes an admin session.
   */
  @Post("sync")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  sync() {
    return this.egpService.sync();
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

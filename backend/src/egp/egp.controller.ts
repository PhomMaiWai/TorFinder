import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { EgpService } from "./egp.service";

@Controller("egp")
export class EgpController {
  constructor(private readonly egpService: EgpService) {}

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  sync() {
    return this.egpService.sync();
  }

  /** Sync counts and success/fail history for the admin dashboard's pipeline card. */
  @Get("metrics")
  @UseGuards(AdminGuard)
  metrics() {
    return this.egpService.metrics();
  }
}

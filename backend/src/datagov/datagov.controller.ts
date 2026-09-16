import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { DataGovService } from "./datagov.service";

@Controller("datagov")
export class DataGovController {
  constructor(private readonly dataGovService: DataGovService) {}

  /**
   * Starting an import is privileged: it spends the portal's patience and
   * rewrites what every visitor sees, so it takes an admin session.
   */
  @Post("sync")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  sync() {
    return this.dataGovService.sync();
  }
}

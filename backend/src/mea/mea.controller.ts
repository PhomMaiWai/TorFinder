import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { MeaService } from "./mea.service";

@Controller("mea")
export class MeaController {
  constructor(private readonly meaService: MeaService) {}

  /**
   * Starting an import is privileged: it spends the portal's patience and
   * rewrites what every visitor sees, so it takes an admin session.
   */
  @Post("sync")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  sync() {
    return this.meaService.sync();
  }
}

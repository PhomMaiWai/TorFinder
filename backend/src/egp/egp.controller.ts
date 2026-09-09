import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { EgpService } from "./egp.service";

@Controller("egp")
export class EgpController {
  constructor(private readonly egpService: EgpService) {}

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  sync() {
    return this.egpService.sync();
  }
}

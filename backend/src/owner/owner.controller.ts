import { Controller, Get, Req, UseGuards } from "@nestjs/common";

import { OwnerGuard } from "../common/owner.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { OwnerService } from "./owner.service";

@Controller("owner")
@UseGuards(OwnerGuard)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  /** The caller's own announcements with their match and feedback counts. */
  @Get("tors")
  ownTors(@Req() request: AuthenticatedRequest) {
    return this.owner.ownTors(request.session.sub);
  }
}

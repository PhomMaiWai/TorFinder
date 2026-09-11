import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { SavedTorsService } from "./saved-tors.service";

@Controller("saved-tors")
@UseGuards(SessionGuard)
export class SavedTorsController {
  constructor(private readonly savedTors: SavedTorsService) {}

  @Get()
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.savedTors.findOwn(request.session.sub);
  }

  @Post(":torId")
  @HttpCode(HttpStatus.NO_CONTENT)
  save(@Req() request: AuthenticatedRequest, @Param("torId") torId: string) {
    return this.savedTors.save(request.session.sub, torId);
  }

  @Delete(":torId")
  @HttpCode(HttpStatus.NO_CONTENT)
  unsave(@Req() request: AuthenticatedRequest, @Param("torId") torId: string) {
    return this.savedTors.unsave(request.session.sub, torId);
  }
}

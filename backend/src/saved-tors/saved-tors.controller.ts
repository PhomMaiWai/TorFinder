import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { ImportSavedTorsDto } from "./dto/import-saved-tors.dto";
import { SavedTorsService } from "./saved-tors.service";

@Controller("saved-tors")
@UseGuards(SessionGuard)
export class SavedTorsController {
  constructor(private readonly savedTors: SavedTorsService) {}

  @Get()
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.savedTors.findOwn(request.session.sub);
  }

  /** Declared before ":torId" so "import" is never read as an id. Answers with the merged list. */
  @Post("import")
  @HttpCode(HttpStatus.OK)
  import(@Req() request: AuthenticatedRequest, @Body() dto: ImportSavedTorsDto) {
    return this.savedTors.import(request.session.sub, dto.torIds);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { CreateSavedSearchDto } from "./dto/create-saved-search.dto";
import { SavedSearchesService } from "./saved-searches.service";

@Controller("saved-searches")
@UseGuards(SessionGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.savedSearches.findOwn(request.session.sub);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSavedSearchDto,
  ) {
    return this.savedSearches.create(request.session.sub, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.savedSearches.remove(request.session.sub, id);
  }
}

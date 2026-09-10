import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { AccountsService } from "./accounts.service";
import { AccountQueryDto } from "./dto/account-query.dto";
import { ReviewAccountDto } from "./dto/review-account.dto";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @UseGuards(AdminGuard)
  findAll(@Query() query: AccountQueryDto) {
    return this.accountsService.findAll(query.status);
  }

  // Declared before ":id" below — otherwise that param route would swallow "/me".
  @Get("me")
  @UseGuards(SessionGuard)
  findOwn(@Req() request: AuthenticatedRequest) {
    return this.accountsService.findOwn(request.session.sub);
  }

  @Patch("me")
  @UseGuards(SessionGuard)
  updateOwn(@Req() request: AuthenticatedRequest, @Body() dto: UpdateCompanyProfileDto) {
    return this.accountsService.updateOwn(request.session.sub, dto);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  review(@Param("id") id: string, @Body() dto: ReviewAccountDto) {
    return this.accountsService.review(id, dto);
  }
}

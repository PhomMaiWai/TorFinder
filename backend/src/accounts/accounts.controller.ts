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

  /** Every account, admin and org alike — the admin dashboard's user directory. */
  @Get("directory")
  @UseGuards(AdminGuard)
  findAllUsers() {
    return this.accountsService.findAllUsers();
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
  review(@Param("id") id: string, @Body() dto: ReviewAccountDto, @Req() request: AuthenticatedRequest) {
    return this.accountsService.review(id, dto, request.session.email);
  }

  /** Blocks sign-in on an already-approved account, without reversing its approval. */
  @Patch(":id/suspend")
  @UseGuards(AdminGuard)
  suspend(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.accountsService.setSuspended(id, true, request.session.email);
  }

  @Patch(":id/reactivate")
  @UseGuards(AdminGuard)
  reactivate(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.accountsService.setSuspended(id, false, request.session.email);
  }
}

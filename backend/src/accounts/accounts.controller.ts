import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { AccountsService } from "./accounts.service";
import { AccountQueryDto } from "./dto/account-query.dto";
import { ReviewAccountDto } from "./dto/review-account.dto";

@Controller("accounts")
@UseGuards(AdminGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@Query() query: AccountQueryDto) {
    return this.accountsService.findAll(query.status);
  }

  @Patch(":id")
  review(@Param("id") id: string, @Body() dto: ReviewAccountDto) {
    return this.accountsService.review(id, dto);
  }
}

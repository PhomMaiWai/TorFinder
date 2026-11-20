import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { StepUpGuard } from "../common/step-up.guard";
import { AccountsService } from "./accounts.service";
import { AdminApprovalsService } from "./admin-approvals.service";
import { AccountQueryDto } from "./dto/account-query.dto";
import { ReviewAccountDto } from "./dto/review-account.dto";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

/**
 * Decisions about who may do what — approval, role, suspension, passkey
 * reset — also need a recent passkey check (StepUpGuard, ASVS 7.5.3).
 */
@Controller("accounts")
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly approvals: AdminApprovalsService,
  ) {}

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

  /** Open requests to grant or remove the admin role (ASVS 2.3.5); declared before ":id" too. */
  @Get("admin-approvals")
  @UseGuards(AdminGuard)
  listAdminApprovals(@Req() request: AuthenticatedRequest) {
    return this.approvals.list(request.session);
  }

  /** A second admin applies the request; the one who asked can't. */
  @Post("admin-approvals/:id/approve")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  approveAdminChange(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.approvals.approve(id, request.session, ip);
  }

  /** The requester cancels, or another admin rejects. */
  @Post("admin-approvals/:id/reject")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  rejectAdminChange(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.approvals.reject(id, request.session, ip);
  }

  // Declared before ":id" below — otherwise that param route would swallow "/me".
  /** Signs every account out (ASVS 7.4.5). Declared before the `:id` routes. */
  @Post("sessions/end-all")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  endEveryonesSessions(@Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.accountsService.endEveryonesSessions(request.session, ip);
  }

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
  @UseGuards(AdminGuard, StepUpGuard)
  review(@Param("id") id: string, @Body() dto: ReviewAccountDto, @Req() request: AuthenticatedRequest) {
    return this.accountsService.review(id, dto, request.session.email);
  }

  /**
   * Rename an account or move it between roles; see AccountsService.updateUser.
   * 202 when the role change waits for a second admin's approval.
   */
  @Patch(":id/details")
  @UseGuards(AdminGuard, StepUpGuard)
  async updateUser(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accountsService.updateUser(id, dto, request.session, ip);
    if (result.pendingApproval) response.status(HttpStatus.ACCEPTED);
    return result;
  }

  /** Blocks sign-in on an already-approved account, without reversing its approval. */
  @Patch(":id/suspend")
  @UseGuards(AdminGuard, StepUpGuard)
  suspend(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.accountsService.setSuspended(id, true, request.session.email);
  }

  @Patch(":id/reactivate")
  @UseGuards(AdminGuard, StepUpGuard)
  reactivate(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.accountsService.setSuspended(id, false, request.session.email);
  }

  /**
   * Emails the account's owner a password-reset link (ASVS 6.4.6). The admin
   * never sees or chooses the password; only the owner's inbox can use the link.
   */
  @Post(":id/password-reset")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  sendPasswordReset(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.accountsService.sendPasswordReset(id, request.session, ip);
  }

  /** Ends every session of this account (ASVS 7.4.5). */
  @Post(":id/sessions/end")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  endUserSessions(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.accountsService.endUserSessions(id, request.session, ip);
  }

  /** A staff member lost their passkey: clear them all, end their sessions, and they add a new one at sign-in. */
  @Post(":id/passkeys/reset")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard, StepUpGuard)
  resetPasskeys(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.accountsService.resetPasskeys(id, request.session, ip);
  }
}

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { ObjectId } from "mongodb";

import { AdminGuard } from "../common/admin.guard";
import { SessionRevocationService } from "../common/session-revocation.service";
import { SessionPayload, verifySessionToken } from "../common/token";
import { env } from "../config/env";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly revocation: SessionRevocationService,
  ) {}

  /**
   * Anyone may report a problem — a guest reading a notice is as likely to spot
   * a wrong date as an account holder — so it gets the tighter budget the login
   * and comment routes use, to keep one script from filling the admins' list.
   * A signed-in reporter is recorded from their session, never from the body.
   */
  @Post("tor/:torId/reports")
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  async create(@Param("torId") torId: string, @Body() dto: CreateReportDto, @Req() request: Request) {
    return this.reports.create(torId, dto, await this.optionalSession(request));
  }

  /** Every report, newest first, for the admin review list (#163). */
  @Get("reports")
  @UseGuards(AdminGuard)
  findAll(@Query() query: ReportQueryDto) {
    return this.reports.findAll(query);
  }

  /**
   * The caller's session when they sent a valid one, else null. A bad or
   * revoked token doesn't refuse the report — the route is open to guests —
   * it just isn't attributed to anyone.
   */
  private async optionalSession(request: Request): Promise<SessionPayload | null> {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;
    if (!session || !ObjectId.isValid(session.sub)) return null;
    return (await this.revocation.isValid(session.sub, session.iat)) ? session : null;
  }
}

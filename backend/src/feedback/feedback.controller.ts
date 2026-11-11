import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { ObjectId } from "mongodb";

import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { SessionRevocationService } from "../common/session-revocation.service";
import { verifySessionToken } from "../common/token";
import { env } from "../config/env";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackQueryDto } from "./dto/feedback-query.dto";
import { ReviewFeedbackDto } from "./dto/review-feedback.dto";
import { FeedbackService } from "./feedback.service";

@Controller()
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly revocation: SessionRevocationService,
  ) {}

  /**
   * Anyone may comment — that is the point of a consultation period — so this
   * route gets the tighter budget the login route uses, to keep one script from
   * filling the queue.
   */
  @Post("tor/:torId/feedback")
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  create(@Param("torId") torId: string, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(torId, dto);
  }

  /**
   * Approved comments on one announcement, for anyone. Comments still waiting
   * for review, or rejected, have not been cleared for publication, so asking
   * for those takes an admin session, same as the moderation queue.
   */
  @Get("tor/:torId/feedback")
  async forTor(@Param("torId") torId: string, @Query() query: FeedbackQueryDto, @Req() request: Request) {
    if (query.status && query.status !== "อนุมัติ" && !(await this.isAdmin(request))) {
      throw new ForbiddenException("ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ");
    }
    return this.feedback.findForTor(torId, query.status);
  }

  /** Approved comment counts per announcement, for listings. */
  @Get("feedback/counts")
  counts() {
    return this.feedback.countsByTor();
  }

  @Get("feedback")
  @UseGuards(AdminGuard)
  findAll(@Query() query: FeedbackQueryDto) {
    return this.feedback.findAll(query.status);
  }

  @Patch("feedback/:id")
  @UseGuards(AdminGuard)
  review(@Param("id") id: string, @Body() dto: ReviewFeedbackDto, @Req() request: AuthenticatedRequest) {
    return this.feedback.review(id, dto.status, request.session.email);
  }

  /** The same checks AdminGuard makes, for a route that is public without a status. */
  private async isAdmin(request: Request): Promise<boolean> {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    const session = scheme === "Bearer" ? verifySessionToken(token) : null;
    if (!session || session.role !== "admin" || !ObjectId.isValid(session.sub)) return false;
    return this.revocation.isValid(session.sub, session.iat);
  }
}

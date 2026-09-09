import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AdminGuard } from "../common/admin.guard";
import { env } from "../config/env";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackQueryDto } from "./dto/feedback-query.dto";
import { ReviewFeedbackDto } from "./dto/review-feedback.dto";
import { FeedbackService } from "./feedback.service";

@Controller()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

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

  /** Approved comments on one announcement; moderators pass a status. */
  @Get("tor/:torId/feedback")
  forTor(@Param("torId") torId: string, @Query() query: FeedbackQueryDto) {
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
  review(@Param("id") id: string, @Body() dto: ReviewFeedbackDto) {
    return this.feedback.review(id, dto.status);
  }
}

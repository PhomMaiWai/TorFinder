import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";

import { ScoreMatchDto } from "./dto/score-match.dto";
import { MatchingService } from "./matching.service";

@Controller("matching")
export class MatchingController {
  constructor(
    private readonly matching: MatchingService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Announcements ranked for the caller's own company. The identity comes from
   * the session, never from a parameter, so one account cannot ask for another's
   * matches.
   */
  @Get("opportunities")
  @UseGuards(SessionGuard)
  opportunities(@Req() request: AuthenticatedRequest) {
    return this.matching.rankOpportunitiesFor(request.session.sub);
  }

  /**
   * Companies an agency could expect to bid, ranked. Names, scores and gaps of
   * every approved company, so it is not for anonymous visitors or for other
   * companies — admin-only until an owner of the announcement can be told apart.
   */
  @Get("tor/:id/companies")
  @UseGuards(AdminGuard)
  companies(@Param("id") id: string) {
    return this.matching.rankForTor(id);
  }

  /** Recompute and store every record's budget verdict. */
  @Post("budget/refresh")
  @UseGuards(AdminGuard)
  async refreshBudgets(@Req() request: AuthenticatedRequest) {
    const result = await this.matching.refreshBudgetStatuses();
    await this.audit.record(
      request.session.email,
      "คำนวณสถานะงบประมาณใหม่",
      `ประเมิน ${result.assessed} รายการ · ติดธง ${result.flagged} รายการ`,
    );
    return result;
  }

  /** How this announcement's budget compares with similar ones. */
  @Get("tor/:id/budget")
  budget(@Param("id") id: string) {
    return this.matching.assessBudgetForTor(id);
  }

  /** A suggested bid price and how contested this kind of work is, from past awards. */
  @Get("tor/:id/bid-insight")
  bidInsight(@Param("id") id: string) {
    return this.matching.assessBidForTor(id);
  }

  /** Score a profile the caller supplies, without it having to be an account yet. */
  @Post("tor/:id/score")
  score(@Param("id") id: string, @Body() dto: ScoreMatchDto) {
    return this.matching.scoreForTor(id, dto);
  }
}

import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";

import { ScoreMatchDto } from "./dto/score-match.dto";
import { MatchingService } from "./matching.service";

@Controller("matching")
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

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

  /** Companies an agency could expect to bid, ranked. */
  @Get("tor/:id/companies")
  companies(@Param("id") id: string) {
    return this.matching.rankForTor(id);
  }

  /** Recompute and store every record's budget verdict. */
  @Post("budget/refresh")
  refreshBudgets() {
    return this.matching.refreshBudgetStatuses();
  }

  /** How this announcement's budget compares with similar ones. */
  @Get("tor/:id/budget")
  budget(@Param("id") id: string) {
    return this.matching.assessBudgetForTor(id);
  }

  /** Score a profile the caller supplies, without it having to be an account yet. */
  @Post("tor/:id/score")
  score(@Param("id") id: string, @Body() dto: ScoreMatchDto) {
    return this.matching.scoreForTor(id, dto);
  }
}

import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { ScoreMatchDto } from "./dto/score-match.dto";
import { MatchingService } from "./matching.service";

@Controller("matching")
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  /** Companies an agency could expect to bid, ranked. */
  @Get("tor/:id/companies")
  companies(@Param("id") id: string) {
    return this.matching.rankForTor(id);
  }

  /** Score a profile the caller supplies, without it having to be an account yet. */
  @Post("tor/:id/score")
  score(@Param("id") id: string, @Body() dto: ScoreMatchDto) {
    return this.matching.scoreForTor(id, dto);
  }
}

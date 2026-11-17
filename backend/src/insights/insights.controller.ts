import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";

import { OrgGuard } from "../common/org.guard";
import { AuthenticatedRequest } from "../common/session.guard";

import { InsightsService } from "./insights.service";

/** The years an award can plausibly carry; anything else is a typo, not a filter. */
const YEAR_RANGE = { min: 2000, max: 2100 };

@Controller("insights")
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /**
   * Who wins, for how much against the reference price, and how contested each
   * agency is (FR-24). Public, like the per-announcement bid insight: every
   * figure comes from a published award notice. `year` is the Christian-era
   * year the award was signed in; leave it out for every year.
   */
  @Get("market")
  market(@Query("year") year?: string) {
    if (year === undefined || year === "") return this.insights.market(null);
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < YEAR_RANGE.min || parsed > YEAR_RANGE.max) {
      throw new BadRequestException("year ต้องเป็นปี ค.ศ. เช่น 2025");
    }
    return this.insights.market(parsed);
  }

  /**
   * A growth path for the caller's own company (#261): where a company its
   * size can start, and the open jobs it can bid on now and one step up.
   * Company accounts only, since it reads the company's own profile.
   */
  @Get("growth")
  @UseGuards(OrgGuard)
  growth(@Req() request: AuthenticatedRequest) {
    return this.insights.growth(request.session.sub);
  }
}

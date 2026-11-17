import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";
import { MatchingService } from "../matching/matching.service";
import { LISTED_TOR } from "../tor/tor.constants";

import { buildGrowthPath, GrowthPath } from "./growth-path";
import { AwardRecord, buildMarketInsights, MarketInsights } from "./market-insights";

@Injectable()
export class InsightsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly matching: MatchingService,
  ) {}

  /**
   * Market insights over every listed record that names a winner or an award
   * amount. Read per request, like the bid insight, so a fresh import shows at
   * once; the awarded set is a few hundred records, not the whole archive.
   */
  async market(year: number | null): Promise<MarketInsights> {
    return buildMarketInsights(await this.awardRecords(), year);
  }

  /**
   * Where the caller's own company can start (#261): agencies that buy jobs
   * its size from few companies, and the open jobs at its size and one step
   * up. The company comes from the session, never from a parameter.
   */
  async growth(userId: string): Promise<GrowthPath> {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีผู้ใช้");
    const user = await this.db.users.findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          "company.largestPastContract": 1,
          "company.preferredBudgetMax": 1,
          "company.pastProjects.value": 1,
          "company.pastProjects.clientType": 1,
        },
      },
    );
    if (!user) throw new NotFoundException("ไม่พบบัญชีผู้ใช้");
    if (!user.company) throw new NotFoundException("บัญชีนี้ยังไม่มีข้อมูลบริษัท");

    const [awards, openJobs] = await Promise.all([
      this.awardRecords(),
      this.matching.rankOpportunitiesFor(userId, 500),
    ]);
    return buildGrowthPath(user.company, awards, openJobs);
  }

  private awardRecords(): Promise<AwardRecord[]> {
    return this.db.tors
      .find(
        {
          ...LISTED_TOR,
          $or: [{ awardedAmount: { $gt: 0 } }, { "contracts.0": { $exists: true } }],
        },
        {
          projection: {
            _id: 0,
            agency: 1,
            createdAt: 1,
            projectNumber: 1,
            budgetAmount: 1,
            referencePrice: 1,
            awardedAmount: 1,
            "contracts.vendor": 1,
            "contracts.amount": 1,
            "contracts.signedAt": 1,
            "extraction.referencePrice": 1,
          },
        },
      )
      .toArray();
  }
}

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { LISTED_TOR } from "../tor/tor.constants";

import { buildMarketInsights, MarketInsights } from "./market-insights";

@Injectable()
export class InsightsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Market insights over every listed record that names a winner or an award
   * amount. Read per request, like the bid insight, so a fresh import shows at
   * once; the awarded set is a few hundred records, not the whole archive.
   */
  async market(year: number | null): Promise<MarketInsights> {
    const records = await this.db.tors
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
    return buildMarketInsights(records, year);
  }
}

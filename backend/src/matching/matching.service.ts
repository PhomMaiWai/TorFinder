import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService } from "../database/database.service";
import { rankCompanies, scoreMatch } from "./matching.scoring";
import { MatchCandidate, MatchResult, RankedCompany } from "./matching.types";

@Injectable()
export class MatchingService {
  constructor(private readonly db: DatabaseService) {}

  /** Approved organizations ranked against one announcement, best first. */
  async rankForTor(torId: string): Promise<RankedCompany[]> {
    const tor = await this.findTor(torId);

    // Only approved accounts with a profile can be matched — a pending signup
    // has nothing to score and shouldn't be suggested to an agency.
    const accounts = await this.db.users
      .find(
        { role: "org", status: "approved", company: { $exists: true } },
        { projection: { company: 1 } },
      )
      .toArray();

    const candidates: MatchCandidate[] = accounts.flatMap((account) =>
      account.company
        ? [
            {
              companyName: account.company.companyName,
              specialty: account.company.specialty,
              size: account.company.size,
            },
          ]
        : [],
    );

    return rankCompanies(tor, candidates);
  }

  /** One company against one announcement — the org's own "do I fit this?" view. */
  async scoreForTor(torId: string, company: MatchCandidate): Promise<MatchResult> {
    return scoreMatch(await this.findTor(torId), company);
  }

  private async findTor(id: string) {
    const tor = ObjectId.isValid(id)
      ? await this.db.tors.findOne(
          { _id: new ObjectId(id) },
          { projection: { title: 1, summary: 1, tags: 1, budget: 1 } },
        )
      : null;
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");
    return tor;
  }
}

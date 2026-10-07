import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AnyBulkWriteOperation, ObjectId } from "mongodb";

import { CompanyProfile, DatabaseService, TorDoc } from "../database/database.service";
import { awardedProjectNumbers, biddingOf } from "../tor/tor-bidding";
import { ACTIONABLE_WINDOW_MS, TOR_STAGES } from "../tor/tor.constants";
import { currentDaysLeft } from "../tor/tor-normalize";
import { assessBudget, BudgetAssessment } from "./budget-analysis";
import { rankCompanies, scoreMatch } from "./matching.scoring";
import { MatchCandidate, MatchResult, RankedCompany } from "./matching.types";

const AWARD_STAGE = TOR_STAGES[2];

/** The stored profile as matching reads it. */
function candidateOf(company: CompanyProfile): MatchCandidate {
  return {
    companyName: company.companyName,
    workTypes: company.workTypes ?? [],
    largestPastContract: company.largestPastContract,
    registeredCapital: company.registeredCapital,
    certifications: company.certifications,
    preferredBudgetMin: company.preferredBudgetMin,
    preferredBudgetMax: company.preferredBudgetMax,
  };
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

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

    return rankCompanies(
      tor,
      accounts.flatMap((account) => (account.company ? [candidateOf(account.company)] : [])),
    ).map(({ companyName, workTypes, score, reasons, gaps, eligibility, eligible }) => ({
      companyName,
      workTypes,
      score,
      reasons,
      gaps,
      eligibility,
      eligible,
    }));
  }

  /**
   * The announcements a company can still act on, best fit first — open ones
   * ahead of those whose closing date is not known yet; closed ones are not
   * opportunities and are left out. This is the dashboard's whole point: a
   * vendor should not have to read every notice to find the few that suit them.
   */
  async rankOpportunitiesFor(userId: string, limit = 100) {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีผู้ใช้");

    const user = await this.db.users.findOne({ _id: new ObjectId(userId) }, { projection: { company: 1 } });
    if (!user) throw new NotFoundException("ไม่พบบัญชีผู้ใช้");
    if (!user.company) throw new NotFoundException("บัญชีนี้ยังไม่มีข้อมูลบริษัท");
    const company = candidateOf(user.company);

    const [tors, awarded] = await Promise.all([
      this.db.tors
        .find(
          {
            deletedAt: { $exists: false },
            stage: { $ne: AWARD_STAGE },
            createdAt: { $gte: new Date(Date.now() - ACTIONABLE_WINDOW_MS) },
          },
          {
            projection: {
              extractionFailure: 0,
              "extraction.scope": 0,
              "extraction.objectives": 0,
              "extraction.deliverables": 0,
              "extraction.paymentTerms": 0,
              "documents.url": 0,
            },
          },
        )
        .toArray(),
      awardedProjectNumbers(this.db.tors),
    ]);

    return tors
      .map(({ _id, extraction, documents, ...tor }) => ({
        id: _id.toString(),
        ...tor,
        daysLeft: currentDaysLeft(tor),
        bidding: biddingOf(
          {
            ...tor,
            documents,
            documentDeadline: extraction?.deadline,
            documentDeadlineTime: extraction?.deadlineTime,
          },
          awarded,
        ),
        ...scoreMatch({ ...tor, extraction }, company),
      }))
      .filter((tor) => tor.bidding.status !== "closed")
      .sort(
        (a, b) =>
          Number(b.bidding.status === "open") - Number(a.bidding.status === "open") || b.score - a.score,
      )
      .slice(0, limit)
      .map(({ score, ...tor }) => ({ ...tor, match: score }));
  }

  /** One company against one announcement — the org's own "do I fit this?" view. */
  async scoreForTor(torId: string, company: MatchCandidate): Promise<MatchResult> {
    return scoreMatch(await this.findTor(torId), company);
  }

  /**
   * How this announcement's budget compares with announcements about the same
   * kind of work. Every imported record is loaded because the comparison set is
   * the whole corpus — a few hundred rows, cheap enough to read per request and
   * always current, where a stored benchmark would go stale after each sync.
   */
  async assessBudgetForTor(torId: string): Promise<BudgetAssessment> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");

    // Only the document's budget figure is read from the extraction; the rest
    // of it is the bulk of every record.
    const projection = { title: 1, summary: 1, tags: 1, budgetAmount: 1, "extraction.budgetAmount": 1 };
    const [tor, all] = await Promise.all([
      this.db.tors.findOne({ _id: new ObjectId(torId) }, { projection }),
      this.db.tors
        .find({ budgetAmount: { $gt: 0 }, deletedAt: { $exists: false } }, { projection })
        .toArray(),
    ]);
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    return assessBudget(
      { ...tor, documentBudget: tor.extraction?.budgetAmount ?? null },
      all.map((peer) => (peer._id.equals(tor._id) ? { ...peer, budgetAmount: undefined } : peer)),
    );
  }

  /**
   * Recomputes every record's budget verdict and stores it, so listings can
   * badge a card without judging 265 announcements per page view. The verdict
   * depends on the whole corpus, so it is refreshed after an import rather than
   * written once — a new announcement can move the percentile another sits at.
   */
  async refreshBudgetStatuses(): Promise<{ assessed: number; flagged: number }> {
    const projection = { title: 1, summary: 1, tags: 1, budgetAmount: 1, "extraction.budgetAmount": 1 };
    const all = await this.db.tors.find({ deletedAt: { $exists: false } }, { projection }).toArray();
    const priced = all.filter((tor) => tor.budgetAmount);

    const writes: AnyBulkWriteOperation<TorDoc>[] = priced.map((tor) => {
      const { status } = assessBudget(
        { ...tor, documentBudget: tor.extraction?.budgetAmount ?? null },
        priced.map((peer) => (peer._id.equals(tor._id) ? { ...peer, budgetAmount: undefined } : peer)),
      );

      // "ไม่ประเมิน" isn't a status a badge can show; leaving the field unset is
      // how a record says nothing rather than saying "normal" without evidence.
      return {
        updateOne: {
          filter: { _id: tor._id },
          update:
            status === "ไม่ประเมิน"
              ? { $unset: { budgetStatus: "" } }
              : { $set: { budgetStatus: status } },
        },
      };
    });

    if (writes.length === 0) return { assessed: 0, flagged: 0 };
    await this.db.tors.bulkWrite(writes, { ordered: false });

    const flagged = await this.db.tors.countDocuments({
      budgetStatus: { $in: ["สูงกว่าปกติ", "ต่ำกว่าปกติ"] },
    });
    this.logger.log(`Budget statuses refreshed: ${writes.length} assessed, ${flagged} flagged`);
    return { assessed: writes.length, flagged };
  }

  private async findTor(id: string) {
    const tor = ObjectId.isValid(id)
      ? await this.db.tors.findOne(
          { _id: new ObjectId(id) },
          {
            projection: {
              title: 1,
              budget: 1,
              budgetAmount: 1,
              referencePrice: 1,
              "extraction.qualifications": 1,
              "extraction.referencePrice": 1,
              "extraction.budgetAmount": 1,
            },
          },
        )
      : null;
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");
    return tor;
  }
}

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AnyBulkWriteOperation, MongoServerError, ObjectId } from "mongodb";

import { env } from "../config/env";
import { CompanyProfile, DatabaseService, TorDoc } from "../database/database.service";
import { NotificationsService } from "../notifications/notifications.service";
import { awardedProjectNumbers, biddingOf } from "../tor/tor-bidding";
import { ACTIONABLE_WINDOW_MS, LISTED_TOR, STAGE, TOR_BUDGET_FLAGS } from "../tor/tor.constants";
import { currentDaysLeft } from "../tor/tor-normalize";
import { assessBid, BidInsight } from "./bid-insight";
import { assessBudget, BudgetAssessment } from "./budget-analysis";
import { alertText, planAlerts, projectKeyOf, sentKey } from "./match-alerts";
import { rankCompanies, ScorableTor, scoreMatch } from "./matching.scoring";
import { MatchCandidate, MatchResult, RankedCompany } from "./matching.types";

const AWARD_STAGE = STAGE.award;
const DUPLICATE_KEY = 11000;

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

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Approved organizations ranked against one announcement, best first. */
  async rankForTor(torId: string): Promise<RankedCompany[]> {
    const tor = await this.findTor(torId);

    return rankCompanies(tor, await this.approvedCandidates()).map(
      ({ companyName, workTypes, score, reasons, gaps, eligibility, eligible }) => ({
        companyName,
        workTypes,
        score,
        reasons,
        gaps,
        eligibility,
        eligible,
      }),
    );
  }

  /**
   * For an owner's own announcements: how many approved companies fit each one
   * at or above the alert threshold — the ones the system would tell about it —
   * and the best score. Companies are loaded once for the whole list.
   */
  async matchSummaries(
    tors: (ScorableTor & { _id: ObjectId })[],
    threshold = env.notify.matchThreshold,
  ): Promise<Map<string, { matchCount: number; topScore: number | null }>> {
    const candidates = await this.approvedCandidates();
    return new Map(
      tors.map((tor) => {
        const fits = rankCompanies(tor, candidates).filter(
          ({ score, eligible }) => score >= threshold && eligible !== false,
        );
        return [tor._id.toString(), { matchCount: fits.length, topScore: fits[0]?.score ?? null }];
      }),
    );
  }

  /**
   * Only approved accounts with a profile can be matched — a pending signup
   * has nothing to score and shouldn't be suggested to an agency.
   */
  private async approvedCandidates(): Promise<MatchCandidate[]> {
    const accounts = await this.db.users
      .find({ role: "org", status: "approved", company: { $exists: true } }, { projection: { company: 1 } })
      .toArray();
    return accounts.flatMap((account) => (account.company ? [candidateOf(account.company)] : []));
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
            ...LISTED_TOR,
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

  /**
   * Tells each approved company about announcements that suit it — the
   * "match" notification, in-app and on whatever outside channels it turned
   * on. Called after every import with the records it added, and after a
   * document is read, since what it says can lift a score over the line.
   *
   * A company hears about a project when it first appears (plan, draft or
   * reference price: time to prepare) and again when bids open, never twice
   * for the same phase: `matchAlerts` remembers what was sent. Each company's
   * own switch and threshold apply, and only records still open to bidding.
   */
  async notifyMatches(torIds: ObjectId[]): Promise<number> {
    if (torIds.length === 0) return 0;

    const [found, awarded, accounts] = await Promise.all([
      this.db.tors
        .find(
          {
            _id: { $in: torIds },
            stage: { $ne: AWARD_STAGE },
            ...LISTED_TOR,
            createdAt: { $gte: new Date(Date.now() - ACTIONABLE_WINDOW_MS) },
          },
          {
            projection: {
              title: 1,
              agency: 1,
              budget: 1,
              budgetAmount: 1,
              referencePrice: 1,
              stage: 1,
              projectNumber: 1,
              deadline: 1,
              daysLeft: 1,
              createdAt: 1,
              procurementStep: 1,
              contractStatus: 1,
              "contracts.signedAt": 1,
              tags: 1,
              summary: 1,
              "documents.label": 1,
              "documents.publishedAt": 1,
              "extraction.qualifications": 1,
              "extraction.referencePrice": 1,
              "extraction.budgetAmount": 1,
              "extraction.deadline": 1,
              "extraction.deadlineTime": 1,
            },
          },
        )
        .toArray(),
      awardedProjectNumbers(this.db.tors),
      this.db.users
        .find(
          {
            role: "org",
            status: "approved",
            suspended: { $ne: true },
            company: { $exists: true },
            "company.matchAlerts": { $ne: false },
          },
          { projection: { company: 1 } },
        )
        .toArray(),
    ]);
    const tors = found.filter(
      (tor) =>
        biddingOf(
          { ...tor, documentDeadline: tor.extraction?.deadline, documentDeadlineTime: tor.extraction?.deadlineTime },
          awarded,
        ).status !== "closed",
    );
    if (tors.length === 0 || accounts.length === 0) return 0;

    const keys = [...new Set(tors.map(projectKeyOf))];
    const alreadySent = await this.db.matchAlerts
      .find(
        { userId: { $in: accounts.map(({ _id }) => _id) }, projectKey: { $in: keys } },
        { projection: { userId: 1, projectKey: 1, phase: 1 } },
      )
      .toArray();
    const sentTo = new Map<string, Set<string>>();
    for (const { userId, projectKey, phase } of alreadySent) {
      const id = userId.toString();
      if (!sentTo.has(id)) sentTo.set(id, new Set());
      sentTo.get(id)!.add(sentKey(projectKey, phase));
    }

    let sent = 0;
    for (const account of accounts) {
      if (!account.company) continue;
      const company = candidateOf(account.company);
      const plan = planAlerts(
        tors.map((tor) => {
          const { score, eligible } = scoreMatch(tor, company);
          return { tor, score, eligible };
        }),
        {
          threshold: account.company.matchThreshold ?? env.notify.matchThreshold,
          max: env.notify.maxMatchesPerRun,
          sent: sentTo.get(account._id.toString()) ?? new Set(),
        },
      );

      for (const alert of plan) {
        // Claimed before sending, so a run racing this one can't alert the same project twice.
        try {
          await this.db.matchAlerts.insertOne({
            userId: account._id,
            projectKey: alert.projectKey,
            phase: alert.phase,
            createdAt: new Date(),
          });
        } catch (error) {
          if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) continue;
          throw error;
        }
        const { title, message } = alertText(alert);
        await this.notifications.create(account._id, "match", title, message, alert.tor._id, alert.score);
        sent++;
      }
    }

    if (sent) this.logger.log(`Match notifications: ${sent} sent for ${tors.length} announcement(s)`);
    return sent;
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
        .find({ budgetAmount: { $gt: 0 }, ...LISTED_TOR }, { projection })
        .toArray(),
    ]);
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    return assessBudget(
      { ...tor, documentBudget: tor.extraction?.budgetAmount ?? null },
      all.map((peer) => (peer._id.equals(tor._id) ? { ...peer, budgetAmount: undefined } : peer)),
    );
  }

  /**
   * What to bid on this announcement, from what comparable projects were won
   * for. Like the budget check, the whole corpus of awarded records is the
   * comparison set, read per request so it is never stale.
   */
  async assessBidForTor(torId: string): Promise<BidInsight> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");

    const projection = {
      title: 1,
      projectNumber: 1,
      summary: 1,
      tags: 1,
      budgetAmount: 1,
      referencePrice: 1,
      awardedAmount: 1,
      "contracts.vendor": 1,
      "contracts.amount": 1,
      "extraction.referencePrice": 1,
    };
    const [tor, awarded] = await Promise.all([
      this.db.tors.findOne({ _id: new ObjectId(torId) }, { projection }),
      this.db.tors
        .find(
          {
            ...LISTED_TOR,
            $or: [{ awardedAmount: { $gt: 0 } }, { "contracts.amount": { $gt: 0 } }],
          },
          { projection },
        )
        .toArray(),
    ]);
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    return assessBid(
      tor,
      awarded.filter((peer) => !peer._id.equals(tor._id)),
    );
  }

  /**
   * Recomputes every record's budget verdict and stores it, so listings can
   * badge a card without judging 265 announcements per page view. The verdict
   * depends on the whole corpus, so it is refreshed after an import rather than
   * written once — a new announcement can move the percentile another sits at.
   */
  async refreshBudgetStatuses(): Promise<{ assessed: number; flagged: number }> {
    const projection = {
      title: 1,
      summary: 1,
      tags: 1,
      budgetAmount: 1,
      lockedFields: 1,
      "extraction.budgetAmount": 1,
    };
    const all = await this.db.tors.find(LISTED_TOR, { projection }).toArray();
    const priced = all.filter((tor) => tor.budgetAmount);

    // A verdict an admin corrected stays theirs; the record still counts as a peer for the rest.
    const assessed = priced.filter((tor) => !tor.lockedFields?.includes("budgetStatus"));
    const writes: AnyBulkWriteOperation<TorDoc>[] = assessed.map((tor) => {
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
      budgetStatus: { $in: TOR_BUDGET_FLAGS },
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

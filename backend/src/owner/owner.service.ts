import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { FeedbackStatus } from "../feedback/feedback.constants";
import { FeedbackService } from "../feedback/feedback.service";
import { MatchingService } from "../matching/matching.service";
import { DatabaseService } from "../database/database.service";
import { currentDaysLeft } from "../tor/tor-normalize";

/** The dashboard's wording for each moderation status. */
const FEEDBACK_KEYS = {
  อนุมัติ: "approved",
  รอตรวจสอบ: "pending",
  ปฏิเสธ: "rejected",
} as const satisfies Record<FeedbackStatus, string>;

type FeedbackCounts = Record<(typeof FEEDBACK_KEYS)[FeedbackStatus], number>;

const toFeedbackCounts = (
  counts: Record<FeedbackStatus, number>,
): FeedbackCounts =>
  Object.fromEntries(
    Object.entries(FEEDBACK_KEYS).map(([status, key]) => [
      key,
      counts[status as FeedbackStatus],
    ]),
  ) as FeedbackCounts;

/**
 * The project owner's dashboard: their own announcements, each with how many
 * companies fit it and how the public hearing is going. Hidden announcements
 * stay off it, as they are off every other listing.
 */
@Injectable()
export class OwnerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly matching: MatchingService,
    private readonly feedback: FeedbackService,
  ) {}

  async ownTors(ownerId: string) {
    const tors = await this.db.tors
      .find(
        { ownerId: new ObjectId(ownerId), deletedAt: { $exists: false } },
        {
          projection: {
            title: 1,
            agency: 1,
            budget: 1,
            budgetAmount: 1,
            referencePrice: 1,
            deadline: 1,
            daysLeft: 1,
            stage: 1,
            createdAt: 1,
            "extraction.qualifications": 1,
            "extraction.referencePrice": 1,
            "extraction.budgetAmount": 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    const [matches, feedback] = await Promise.all([
      this.matching.matchSummaries(tors),
      this.feedback.statusCountsFor(tors.map(({ _id }) => _id)),
    ]);

    const items = tors.map((tor) => {
      const id = tor._id.toString();
      return {
        id,
        title: tor.title,
        agency: tor.agency,
        budget: tor.budget,
        deadline: tor.deadline,
        daysLeft: currentDaysLeft(tor),
        stage: tor.stage,
        createdAt: tor.createdAt,
        matchCount: matches.get(id)?.matchCount ?? 0,
        topScore: matches.get(id)?.topScore ?? null,
        feedback: toFeedbackCounts(feedback.get(id)!),
      };
    });

    return {
      totals: {
        tors: items.length,
        matches: items.reduce((sum, item) => sum + item.matchCount, 0),
        feedback: items.reduce(
          (sum, { feedback: counts }) => ({
            approved: sum.approved + counts.approved,
            pending: sum.pending + counts.pending,
            rejected: sum.rejected + counts.rejected,
          }),
          { approved: 0, pending: 0, rejected: 0 },
        ),
      },
      tors: items,
    };
  }
}

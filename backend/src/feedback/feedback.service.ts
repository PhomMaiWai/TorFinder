import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { DatabaseService, FeedbackDoc } from "../database/database.service";
import { STAGE } from "../tor/tor.constants";
import { awardedProjectNumbers, biddingOf } from "../tor/tor-bidding";
import { bangkokDay } from "../tor/tor-normalize";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackStatus } from "./feedback.constants";

/** Shown in place of a name when someone comments without giving one. */
const ANONYMOUS = "ประชาชนทั่วไป";

/** Audit action label per moderation decision; a re-queue to "รอตรวจสอบ" logs nothing. */
const REVIEW_AUDIT_ACTIONS: Partial<Record<FeedbackStatus, string>> = {
  อนุมัติ: "อนุมัติความคิดเห็น",
  ปฏิเสธ: "ปฏิเสธความคิดเห็น",
};

const AUDIT_DETAIL_MAX_LENGTH = 100;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Files a comment against an announcement. It stays unpublished until
   * reviewed. Only a draft TOR is out for public comment, and only until its
   * window closes — after that the agency is no longer listening, so a late
   * comment is refused rather than queued for nobody. The same rule decides
   * whether the detail page shows the form (frontend tor-ui.ts feedbackWindow).
   */
  async create(torId: string, dto: CreateFeedbackDto) {
    const tor = await this.findTorId(torId);
    await this.assertOpenForComment(tor);

    const doc: FeedbackDoc = {
      torId: tor,
      author: dto.author?.trim() || ANONYMOUS,
      text: dto.text.trim(),
      status: "รอตรวจสอบ",
      createdAt: new Date(),
    };

    const { insertedId } = await this.db.feedback.insertOne({ ...doc });
    return { id: insertedId.toString(), ...doc, torId: torId };
  }

  /**
   * Comments on one announcement. Public callers get the approved ones; the
   * moderation views ask for a specific status, including the queue itself.
   */
  /** The approved comments only: this backs a public route. */
  async findForTor(torId: string) {
    const tor = await this.findTorId(torId);
    return this.list({ torId: tor, status: "อนุมัติ" });
  }

  /** The moderation queue across every announcement, oldest first — first in, first judged. */
  async findAll(status?: FeedbackStatus) {
    return this.list(status ? { status } : {});
  }

  /** Publishes or rejects one comment. */
  async review(id: string, status: FeedbackStatus, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบความคิดเห็น");

    const result = await this.db.feedback.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, reviewedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบความคิดเห็น");

    const action = REVIEW_AUDIT_ACTIONS[status];
    if (action) {
      const excerpt =
        result.text.length > AUDIT_DETAIL_MAX_LENGTH
          ? `${result.text.slice(0, AUDIT_DETAIL_MAX_LENGTH)}…`
          : result.text;
      await this.audit.record(actor, action, `${result.author}: ${excerpt}`);
    }

    const { _id, torId, ...rest } = result;
    return { id: _id.toString(), torId: torId.toString(), ...rest };
  }

  /** How many comments each announcement has, for listings that show a count. */
  async countsByTor(status: FeedbackStatus = "อนุมัติ"): Promise<Record<string, number>> {
    const rows = await this.db.feedback
      .aggregate<{ _id: ObjectId; count: number }>([
        { $match: { status } },
        { $group: { _id: "$torId", count: { $sum: 1 } } },
      ])
      .toArray();

    return Object.fromEntries(rows.map((row) => [row._id.toString(), row.count]));
  }

  private async list(filter: Filter<FeedbackDoc>) {
    const docs = await this.db.feedback.find(filter).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, torId, ...rest }) => ({
      id: _id.toString(),
      torId: torId.toString(),
      ...rest,
    }));
  }

  /** A comment can only exist against an announcement that does. */
  /**
   * Open for comment: a draft, whose comment deadline (the portal's, else the
   * one read off the document) hasn't passed — or, with no such date, which
   * hasn't been closed by a deadline, an award, a contract, a cancellation or
   * a later announcement.
   */
  private async assertOpenForComment(id: ObjectId): Promise<void> {
    const tor = await this.db.tors.findOne(
      { _id: id },
      {
        projection: {
          stage: 1,
          deadline: 1,
          createdAt: 1,
          procurementStep: 1,
          contractStatus: 1,
          projectNumber: 1,
          contracts: 1,
          documents: 1,
          feedbackDeadline: 1,
          "extraction.feedbackDeadline": 1,
          "extraction.deadline": 1,
          "extraction.deadlineTime": 1,
        },
      },
    );
    if (!tor || tor.stage !== STAGE.draft) {
      throw new BadRequestException("ประกาศนี้ไม่ได้อยู่ในช่วงรับฟังความคิดเห็น");
    }

    const deadline = tor.feedbackDeadline ?? tor.extraction?.feedbackDeadline ?? null;
    if (deadline) {
      if (bangkokDay(new Date())! > deadline) throw new BadRequestException("ปิดรับฟังความคิดเห็นสำหรับประกาศนี้แล้ว");
      return;
    }

    const bidding = biddingOf(
      { ...tor, documentDeadline: tor.extraction?.deadline, documentDeadlineTime: tor.extraction?.deadlineTime },
      await awardedProjectNumbers(this.db.tors),
    );
    if (bidding.status === "closed") throw new BadRequestException("ปิดรับฟังความคิดเห็นสำหรับประกาศนี้แล้ว");
  }

  private async findTorId(torId: string): Promise<ObjectId> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const id = new ObjectId(torId);
    const exists = await this.db.tors.countDocuments({ _id: id }, { limit: 1 });
    if (!exists) throw new NotFoundException("ไม่พบรายการ TOR");
    return id;
  }
}

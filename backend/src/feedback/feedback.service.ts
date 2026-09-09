import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { DatabaseService, FeedbackDoc } from "../database/database.service";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackStatus } from "./feedback.constants";

/** Shown in place of a name when someone comments without giving one. */
const ANONYMOUS = "ประชาชนทั่วไป";

@Injectable()
export class FeedbackService {
  constructor(private readonly db: DatabaseService) {}

  /** Files a comment against an announcement. It stays unpublished until reviewed. */
  async create(torId: string, dto: CreateFeedbackDto) {
    const tor = await this.findTorId(torId);

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
  async findForTor(torId: string, status?: FeedbackStatus) {
    const tor = await this.findTorId(torId);
    return this.list({ torId: tor, status: status ?? "อนุมัติ" });
  }

  /** The moderation queue across every announcement, oldest first — first in, first judged. */
  async findAll(status?: FeedbackStatus) {
    return this.list(status ? { status } : {});
  }

  /** Publishes or rejects one comment. */
  async review(id: string, status: FeedbackStatus) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบความคิดเห็น");

    const result = await this.db.feedback.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, reviewedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบความคิดเห็น");

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
  private async findTorId(torId: string): Promise<ObjectId> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const id = new ObjectId(torId);
    const exists = await this.db.tors.countDocuments({ _id: id }, { limit: 1 });
    if (!exists) throw new NotFoundException("ไม่พบรายการ TOR");
    return id;
  }
}

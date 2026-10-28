import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { assessConfidence } from "../ai/extraction-confidence";
import { AuditService } from "../audit/audit.service";
import { DatabaseService, TorDoc } from "../database/database.service";
import { MatchingService } from "../matching/matching.service";
import { env } from "../config/env";
import { CreateTorDto } from "./dto/create-tor.dto";
import { TorSource } from "./dto/list-tor-query.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";
import { FLAGGED_TOR_FILTERS } from "./dto/list-flagged-tor-query.dto";
import { LISTED_TOR, LOW_COMPETITION_METHODS, STAGE_LISTING_ORDER, TOR_BUDGET_FLAGS } from "./tor.constants";
import { awardedProjectNumbers, biddingOf } from "./tor-bidding";
import { buildTimeline } from "./tor-stage";
import { isLikelyDuplicateTitle, isLikelySameAgency } from "./tor-dedup";
import { isArchiveDocument, isViewableDocument } from "./tor-documents";
import { currentDaysLeft } from "./tor-normalize";

/**
 * Where an announcement sits in its own lifecycle, as a number to sort on.
 * STAGE_LISTING_ORDER is that order — a draft open for comment, an invitation
 * still taking bids, an award that closed the whole thing — so the position in
 * it is the rank.
 *
 * It matters more than it sounds: the portals publish award notices daily and
 * drafts rarely, so ordering by date alone buries everything a company could
 * actually bid on under announcements it has already lost — two thirds of the
 * collection are awards, and they filled the whole first page.
 *
 * Computed per query rather than stored, which no index can serve. Fine for a
 * collection this size; a much larger one would want the rank written onto the
 * record at import time instead.
 */
const STAGE_RANK = {
  $let: {
    vars: { rank: { $indexOfArray: [STAGE_LISTING_ORDER, "$stage"] } },
    // A stage from outside the list sorts last rather than silently first.
    in: { $cond: [{ $lt: ["$$rank", 0] }, STAGE_LISTING_ORDER.length, "$$rank"] },
  },
};

/** Why a flagged record is on the auditor's list, in the auditor's own terms. */
const BUDGET_FLAG_REASON: Record<(typeof TOR_BUDGET_FLAGS)[number], string> = {
  สูงกว่าปกติ: "วงเงินงบประมาณสูงกว่าปกติ เมื่อเทียบกับโครงการลักษณะเดียวกัน",
  ต่ำกว่าปกติ: "วงเงินงบประมาณต่ำกว่าปกติ เมื่อเทียบกับโครงการลักษณะเดียวกัน",
};

/** A substring match on the free-text `procurementMethod` field — see LOW_COMPETITION_METHODS. */
const LOW_COMPETITION_PATTERN = new RegExp(LOW_COMPETITION_METHODS.join("|"));

function competitionReason(method: string): string {
  return `จัดซื้อจัดจ้างด้วยวิธี${method} ซึ่งโดยลักษณะวิธีมีผู้เสนอราคาน้อยราย`;
}

@Injectable()
export class TorService {
  private readonly logger = new Logger(TorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly matching: MatchingService,
  ) {}

  async create(dto: CreateTorDto, actor: string) {
    const duplicate = await this.findLikelyDuplicate(dto.title, dto.agency);
    if (duplicate) {
      throw new ConflictException(
        `มีรายการ TOR ที่คล้ายกันอยู่แล้ว: "${duplicate.title}" (${duplicate._id.toString()})`,
      );
    }

    const doc = { ...dto, match: 0, createdAt: new Date() };
    // insertOne mutates what it is given by adding _id — pass a copy so the
    // response keeps exposing only `id`.
    const { insertedId } = await this.db.tors.insertOne({ ...doc });
    await this.audit.record(actor, "เพิ่มประกาศ TOR", dto.title);
    // Same as an import: companies it suits hear about it. A failed send doesn't undo the record.
    await this.matching
      .notifyMatches([insertedId])
      .catch((error: unknown) => this.logger.warn(`Match notifications failed: ${String(error)}`));
    return { id: insertedId.toString(), ...doc };
  }

  /**
   * Admin-entered records have no project number to key off, so this is the
   * best signal available: same-ish title, same-ish agency, against every
   * live record regardless of which source created it.
   */
  private async findLikelyDuplicate(title: string, agency: string) {
    const candidates = await this.db.tors
      .find({ deletedAt: { $exists: false } }, { projection: { title: 1, agency: 1 } })
      .toArray();

    return candidates.find(
      (candidate) =>
        isLikelySameAgency(candidate.agency, agency) && isLikelyDuplicateTitle(candidate.title, title),
    );
  }

  async findAll(page = 1, pageSize = 20, source?: TorSource) {
    // Deleted records stay in the collection but out of every listing except
    // the one that exists to restore them.
    const filter: Filter<TorDoc> = {
      ...LISTED_TOR,
      createdAt: { $gte: env.torListedSince },
    };
    // Imported records carry their portal as the prefix of `sourceRef`, so the
    // source is filtered on the same anchored prefix an index can serve.
    if (source === "manual") filter.sourceRef = { $exists: false };
    else if (source) filter.sourceRef = { $regex: `^${source}:` };

    const [docs, awarded] = await Promise.all([
      this.db.tors
        .aggregate<
          TorDoc & { _id: ObjectId; documentDeadline?: string | null; documentDeadlineTime?: string | null }
        >([
          { $match: filter },
          // No listing shows what the model read out of a document, and it is
          // the bulk of every record — only the closing date it found is kept,
          // for the open/closed flag, before the sort has to carry the rest.
          {
            $set: {
              documentDeadline: "$extraction.deadline",
              documentDeadlineTime: "$extraction.deadlineTime",
            },
          },
          { $unset: ["extraction", "extractionFailure"] },
          // Each stage numbered separately, newest first...
          {
            $setWindowFields: {
              partitionBy: "$stage",
              sortBy: { createdAt: -1 },
              output: { stageSeq: { $documentNumber: {} } },
            },
          },
          { $addFields: { stageRank: STAGE_RANK } },
          // ...then read across the stages rather than down one: the newest of
          // each, then the second newest of each. Every page carries all three,
          // and within a round the ones still open come first.
          { $sort: { stageSeq: 1, stageRank: 1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          { $project: { stageSeq: 0, stageRank: 0 } },
        ])
        .toArray(),
      awardedProjectNumbers(this.db.tors),
    ]);
    return docs.map(({ _id, documentDeadline, documentDeadlineTime, ...rest }) => ({
      id: _id.toString(),
      ...rest,
      daysLeft: currentDaysLeft(rest),
      bidding: biddingOf({ ...rest, documentDeadline, documentDeadlineTime }, awarded),
      currentStage: rest.stage,
      timeline: buildTimeline(rest),
    }));
  }

  async findOne(id: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");
    const [doc, awarded] = await Promise.all([
      this.db.tors.findOne({ _id: new ObjectId(id) }, { projection: { extractionFailure: 0 } }),
      awardedProjectNumbers(this.db.tors),
    ]);
    if (!doc) throw new NotFoundException("ไม่พบรายการ TOR");
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
      extraction: rest.extraction && {
        ...rest.extraction,
        assessment: assessConfidence(rest.extraction, rest),
      },
      // Which files the detail page can show in place rather than link out to.
      documents: rest.documents?.map((file) => ({
        ...file,
        viewable: isViewableDocument(file.url),
        archive: isArchiveDocument(file.url),
      })),
      daysLeft: currentDaysLeft(rest),
      bidding: biddingOf(
        {
          ...rest,
          documentDeadline: rest.extraction?.deadline,
          documentDeadlineTime: rest.extraction?.deadlineTime,
        },
        awarded,
      ),
      currentStage: rest.stage,
      timeline: buildTimeline(rest),
    };
  }

  /** Hidden announcements, newest first — the restore view. */
  async findDeleted() {
    const docs = await this.db.tors
      .find({ deletedAt: { $exists: true } })
      .sort({ deletedAt: -1 })
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  /**
   * Announcements worth the Auditor Office's attention, on either of two
   * independent grounds — never a conclusion on its own, just worth a second
   * look:
   *  - budget: a price well outside what comparable projects asked for, in
   *    either direction ("ปกติ" and never-assessed records never appear here;
   *    see refreshBudgetStatuses).
   *  - competition: procured by a method whose nature involves few bidders
   *    (see LOW_COMPETITION_METHODS — the Auditor Office's own agreed list).
   * A record can be on the list for one reason, the other, or both.
   */
  async findFlagged(page = 1, pageSize = 20, flag?: (typeof FLAGGED_TOR_FILTERS)[number]) {
    const budgetCondition: Filter<TorDoc> = { budgetStatus: { $in: TOR_BUDGET_FLAGS } };
    const competitionCondition: Filter<TorDoc> = { procurementMethod: { $regex: LOW_COMPETITION_PATTERN } };

    const flagCondition: Filter<TorDoc> =
      flag === "budget-high"
        ? { budgetStatus: "สูงกว่าปกติ" }
        : flag === "budget-low"
          ? { budgetStatus: "ต่ำกว่าปกติ" }
          : flag === "competition"
            ? competitionCondition
            : { $or: [budgetCondition, competitionCondition] };

    const filter: Filter<TorDoc> = { ...LISTED_TOR, ...flagCondition };
    const projection = {
      title: 1,
      agency: 1,
      budget: 1,
      budgetAmount: 1,
      stage: 1,
      budgetStatus: 1,
      procurementMethod: 1,
      sourceUrl: 1,
      projectNumber: 1,
      createdAt: 1,
    };

    const [docs, total] = await Promise.all([
      this.db.tors
        .find(filter, { projection })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.db.tors.countDocuments(filter),
    ]);

    return {
      total,
      page,
      pageSize,
      items: docs.map(({ _id, budgetStatus: status, procurementMethod, ...rest }) => {
        const budgetFlagged =
          status && TOR_BUDGET_FLAGS.includes(status as (typeof TOR_BUDGET_FLAGS)[number])
            ? (status as (typeof TOR_BUDGET_FLAGS)[number])
            : undefined;
        const competitionFlagged =
          procurementMethod && LOW_COMPETITION_PATTERN.test(procurementMethod) ? procurementMethod : undefined;

        const reasons: string[] = [];
        if (budgetFlagged) reasons.push(BUDGET_FLAG_REASON[budgetFlagged]);
        if (competitionFlagged) reasons.push(competitionReason(competitionFlagged));

        // Only ever surfaced when it's actually *why* the record is on the
        // list — a "ปกติ" budgetStatus or a competitive procurementMethod
        // (e.g. "e-bidding") on a record flagged for the other reason must
        // never render as if it were itself a flag.
        return {
          id: _id.toString(),
          ...rest,
          budgetStatus: budgetFlagged,
          procurementMethod: competitionFlagged,
          reasons,
        };
      }),
    };
  }

  /**
   * Hides an announcement without destroying it. Nothing about a public
   * procurement notice should be unrecoverable by a single click, so the record
   * keeps its data and only gains a timestamp.
   */
  async softDelete(id: string, actor: string) {
    const result = await this.setDeletedAt(id, new Date());
    await this.audit.record(actor, "ซ่อนประกาศ TOR", result.title);
    return result;
  }

  async restore(id: string, actor: string) {
    const result = await this.setDeletedAt(id, null);
    await this.audit.record(actor, "กู้คืนประกาศ TOR", result.title);
    return result;
  }

  private async setDeletedAt(id: string, deletedAt: Date | null) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");

    const result = await this.db.tors.findOneAndUpdate(
      { _id: new ObjectId(id) },
      deletedAt ? { $set: { deletedAt } } : { $unset: { deletedAt: "" } },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบรายการ TOR");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }

  /**
   * An admin's correction. Only the fields that actually differ from what is
   * stored are written, and each one is locked so the next import of the same
   * record leaves it alone (TorImportService). The record remembers who made
   * the last correction and when; the audit log says what changed.
   */
  async update(id: string, dto: UpdateTorDto, editor: { email: string; name: string }) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");
    const _id = new ObjectId(id);

    const current = await this.db.tors.findOne({ _id });
    if (!current) throw new NotFoundException("ไม่พบรายการ TOR");

    const changes = changedFields(current, dto);
    if (Object.keys(changes).length === 0) {
      const { _id: unchanged, ...rest } = current;
      return { id: unchanged.toString(), ...rest };
    }

    const result = await this.db.tors.findOneAndUpdate(
      { _id },
      {
        $set: { ...changes, lastEdited: { by: editor.name, at: new Date() } },
        $addToSet: { lockedFields: { $each: Object.keys(changes) } },
      },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบรายการ TOR");

    const { classification, ...corrected } = changes;
    await Promise.all([
      Object.keys(corrected).length > 0 &&
        this.audit.record(
          editor.email,
          "แก้ไขข้อมูลประกาศ TOR",
          `${result.title}: ${Object.keys(corrected)
            .map((field) => FIELD_LABELS[field as keyof typeof FIELD_LABELS] ?? field)
            .join(", ")}`,
        ),
      classification &&
        this.audit.record(
          editor.email,
          "จัดประเภทประกาศ TOR ใหม่",
          `${result.title} → ${classification === "not-software" ? "ไม่ใช่งานซอฟต์แวร์" : "งานซอฟต์แวร์"}`,
        ),
    ]);

    const { _id: updated, ...rest } = result;
    return { id: updated.toString(), ...rest };
  }

  /**
   * Links an announcement to the project owner account responsible for it, or
   * unlinks it (`null`); /api/owner reads by this link. It is not a correction
   * of the published data, so it locks nothing and leaves "last edited" alone —
   * the audit log records who linked whom.
   */
  async setOwner(id: string, ownerId: string | null, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");
    const _id = new ObjectId(id);
    const tor = await this.db.tors.findOne({ _id }, { projection: { title: 1, ownerId: 1 } });
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    const owner = ownerId
      ? await this.db.users.findOne({ _id: new ObjectId(ownerId) }, { projection: { email: 1, name: 1, role: 1 } })
      : null;
    // Only an owner account has an owner dashboard to see the record on.
    if (ownerId && owner?.role !== "owner") {
      throw new BadRequestException("บัญชีนี้ไม่ใช่บัญชีเจ้าของโครงการ");
    }

    if ((tor.ownerId?.toString() ?? null) !== ownerId) {
      await this.db.tors.updateOne({ _id }, owner ? { $set: { ownerId: owner._id } } : { $unset: { ownerId: "" } });
      await this.audit.record(
        actor,
        owner ? "กำหนดเจ้าของประกาศ TOR" : "ยกเลิกเจ้าของประกาศ TOR",
        owner ? `${tor.title} → ${owner.name} (${owner.email})` : tor.title,
      );
    }
    return this.findOne(id);
  }

  /** Announcements an admin marked as outside software work — the list that can put them back. */
  async findNotSoftware() {
    const docs = await this.db.tors
      .find(
        { classification: "not-software", deletedAt: { $exists: false } },
        { projection: { extraction: 0, extractionFailure: 0 } },
      )
      .sort({ "lastEdited.at": -1 })
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }
}

/** How the audit log names each field an admin can correct. */
const FIELD_LABELS = {
  title: "ชื่อโครงการ",
  agency: "หน่วยงาน",
  budget: "งบประมาณ",
  deadline: "วันที่ปิดรับ",
  daysLeft: "จำนวนวันที่เหลือ",
  tags: "แท็ก",
  stage: "สถานะ",
  summary: "รายละเอียด",
  budgetStatus: "สถานะงบประมาณ",
} as const;

/**
 * The fields of an edit that differ from the stored record. The edit form
 * sends every field every time, so without this a save would lock fields the
 * admin never touched. Two values read the same to the admin are not a change:
 * "ปกติ" against no budget status, and the days left the detail page showed
 * (worked out from the deadline) against the stored count.
 */
function changedFields(current: TorDoc, dto: UpdateTorDto): Partial<TorDoc> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    const stored = current[key as keyof TorDoc];
    const same =
      key === "tags"
        ? JSON.stringify(stored ?? []) === JSON.stringify(value)
        : key === "budgetStatus"
          ? (stored ?? "ปกติ") === value
          : key === "classification"
            ? (stored ?? "software") === value
            : key === "daysLeft"
              ? stored === value || currentDaysLeft(current) === value
              : stored === value;
    if (!same) changes[key] = value;
  }
  return changes as Partial<TorDoc>;
}

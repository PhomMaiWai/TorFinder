import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import { Filter, ObjectId } from "mongodb";

import { assessConfidence } from "../ai/extraction-confidence";
import { AuditService } from "../audit/audit.service";
import { DatabaseService, TorDoc } from "../database/database.service";
import { MatchingService } from "../matching/matching.service";
import { workTypesOf } from "../matching/work-types";
import { env } from "../config/env";
import { CreateTorDto } from "./dto/create-tor.dto";
import { TorSource } from "./dto/list-tor-query.dto";
import { UpdateExtractionDto } from "./dto/update-extraction.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";
import { LISTED_TOR, STAGE_LISTING_ORDER } from "./tor.constants";
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
              // The portal's own comment window first; what the model read only fills a gap.
              feedbackDeadline: { $ifNull: ["$feedbackDeadline", "$extraction.feedbackDeadline", "$$REMOVE"] },
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
      timeline: buildTimeline({
        ...rest,
        awarded: rest.projectNumber != null && awarded.has(rest.projectNumber),
      }),
      // The kinds of work its title names, as matching reads them: the
      // overview charts budget by them (#257).
      workTypes: workTypesOf(rest.title),
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
      feedbackDeadline: rest.feedbackDeadline ?? rest.extraction?.feedbackDeadline ?? undefined,
      bidding: biddingOf(
        {
          ...rest,
          documentDeadline: rest.extraction?.deadline,
          documentDeadlineTime: rest.extraction?.deadlineTime,
        },
        awarded,
      ),
      currentStage: rest.stage,
      timeline: buildTimeline({
        ...rest,
        awarded: rest.projectNumber != null && awarded.has(rest.projectNumber),
      }),
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
   * An admin's review of what the AI read off the document. Only fields that
   * differ from the stored reading are written; either way the reading is
   * marked reviewed, which also keeps the AI job from re-reading it later
   * (ExtractionService). The audit log names the fields that changed.
   */
  async updateExtraction(id: string, dto: UpdateExtractionDto, editor: { email: string; name: string }) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");
    const _id = new ObjectId(id);

    const current = await this.db.tors.findOne({ _id }, { projection: { title: 1, extraction: 1 } });
    if (!current) throw new NotFoundException("ไม่พบรายการ TOR");
    if (!current.extraction) throw new BadRequestException("ประกาศนี้ยังไม่มีข้อมูลที่ AI อ่านจากเอกสาร");

    const { reviewed, ...fields } = dto;
    const changes: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(fields) as [keyof typeof fields, unknown][]) {
      if (value === undefined) continue;
      // A reading from before a field existed has no value for it: the same as empty.
      const stored = current.extraction[field] ?? (Array.isArray(value) ? [] : null);
      if (!isDeepStrictEqual(stored, value)) changes[field] = value;
    }
    if (Object.keys(changes).length === 0 && !reviewed) return this.findOne(id);

    await this.db.tors.updateOne(
      { _id },
      {
        $set: {
          ...Object.fromEntries(Object.entries(changes).map(([field, value]) => [`extraction.${field}`, value])),
          "extraction.reviewed": { by: editor.name, at: new Date() },
        },
      },
    );

    const changed = Object.keys(changes);
    await this.audit.record(
      editor.email,
      "ตรวจทานข้อมูลที่ AI อ่านจากเอกสาร TOR",
      changed.length > 0
        ? `${current.title}: ${changed.map((field) => EXTRACTION_FIELD_LABELS[field] ?? field).join(", ")}`
        : `${current.title}: ยืนยันว่าถูกต้อง`,
    );
    // Qualifications and figures feed the match score; a corrected reading can
    // lift a company over its line (or rule it out), as a fresh AI reading does.
    if (changed.length > 0) {
      await this.matching
        .notifyMatches([_id])
        .catch((error: unknown) => this.logger.warn(`Match notifications after review failed: ${String(error)}`));
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
/** How the audit log names each AI-read field an admin corrected. */
const EXTRACTION_FIELD_LABELS: Record<string, string> = {
  scope: "ขอบเขตงาน",
  objectives: "วัตถุประสงค์",
  qualifications: "คุณสมบัติผู้เสนอราคา",
  deliverables: "สิ่งที่ต้องส่งมอบ",
  paymentTerms: "งวดงานและการจ่ายเงิน",
  budgetAmount: "งบประมาณในเอกสาร",
  referencePrice: "ราคากลาง",
  deadline: "วันสิ้นสุดในเอกสาร",
  deadlineTime: "ช่วงเวลา",
  feedbackDeadline: "วันสิ้นสุดรับฟังความคิดเห็น",
  contractPeriod: "ระยะเวลาสัญญา",
  evaluationCriteria: "เกณฑ์การพิจารณา",
  bidSecurity: "หลักประกัน",
  penalty: "ค่าปรับ",
  warrantyPeriod: "ระยะเวลารับประกัน",
  contact: "ช่องทางติดต่อ",
};

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
 * Every field an admin can correct. changedFields walks this list rather than
 * the request body, so the field names that get written are always these
 * constants, never a key that came from the request (CodeQL js/remote-property-injection).
 * Typed as a Record over UpdateTorDto so the build fails if a field is added
 * to the DTO but not here (it would pass validation and then be dropped).
 */
const UPDATABLE: Record<keyof UpdateTorDto, true> = {
  title: true,
  agency: true,
  budget: true,
  deadline: true,
  daysLeft: true,
  tags: true,
  stage: true,
  summary: true,
  budgetStatus: true,
  classification: true,
};
const UPDATABLE_FIELDS = Object.keys(UPDATABLE) as (keyof UpdateTorDto)[];

/**
 * The fields of an edit that differ from the stored record. The edit form
 * sends every field every time, so without this a save would lock fields the
 * admin never touched. Two values read the same to the admin are not a change:
 * "ปกติ" against no budget status, and the days left the detail page showed
 * (worked out from the deadline) against the stored count.
 */
function changedFields(current: TorDoc, dto: UpdateTorDto): Partial<TorDoc> {
  const changes = new Map<string, unknown>();
  for (const key of UPDATABLE_FIELDS) {
    const value = dto[key];
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
    if (!same) changes.set(key, value);
  }
  return Object.fromEntries(changes) as Partial<TorDoc>;
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId, WithId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { SessionPayload } from "../common/token";
import { DatabaseService, TorReportDoc } from "../database/database.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportStatus } from "./reports.constants";

/** How much of a report's message the audit entry quotes, as the feedback entries do. */
const AUDIT_EXCERPT_LENGTH = 100;

/** A report as the API returns it: ids as strings, the reporter without their account id. */
function toView({ _id, torId, reporter, ...rest }: WithId<TorReportDoc>) {
  return {
    id: _id.toString(),
    torId: torId.toString(),
    ...rest,
    reporter: reporter && { email: reporter.email, name: reporter.name },
  };
}

/**
 * Reports that an announcement is wrong (FR-21). Anyone may file one; only an
 * admin reads them. They are never published: a report is a claim for an admin
 * to check against the source, not a fact about the record.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async create(torId: string, dto: CreateReportDto, reporter: SessionPayload | null) {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = new ObjectId(torId);
    // A hidden record is out of every listing, but someone who still has its
    // page open can say what is wrong with it — that may be why it was hidden.
    if (!(await this.db.tors.countDocuments({ _id: tor }, { limit: 1 }))) {
      throw new NotFoundException("ไม่พบรายการ TOR");
    }

    const doc: TorReportDoc = {
      torId: tor,
      reason: dto.reason,
      message: dto.message,
      ...(reporter
        ? { reporter: { userId: new ObjectId(reporter.sub), email: reporter.email, name: reporter.name } }
        : dto.contact
          ? { contact: dto.contact }
          : {}),
      status: "open",
      createdAt: new Date(),
    };
    const { insertedId } = await this.db.torReports.insertOne({ ...doc });
    return toView({ _id: insertedId, ...doc });
  }

  /**
   * An admin closing a report once it has been dealt with, or reopening one.
   * Resolving records who and when; reopening clears both. Setting the status
   * it already has changes nothing and logs nothing.
   */
  async setStatus(id: string, status: ReportStatus, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบเรื่องที่แจ้ง");
    const _id = new ObjectId(id);
    const current = await this.db.torReports.findOne({ _id });
    if (!current) throw new NotFoundException("ไม่พบเรื่องที่แจ้ง");
    if (current.status === status) return toView(current);

    const updated = await this.db.torReports.findOneAndUpdate(
      { _id },
      status === "resolved"
        ? { $set: { status, resolvedAt: new Date(), resolvedBy: actor } }
        : { $set: { status }, $unset: { resolvedAt: "", resolvedBy: "" } },
      { returnDocument: "after" },
    );
    if (!updated) throw new NotFoundException("ไม่พบเรื่องที่แจ้ง");

    const tor = await this.db.tors.findOne({ _id: current.torId }, { projection: { title: 1 } });
    const excerpt =
      current.message.length > AUDIT_EXCERPT_LENGTH
        ? `${current.message.slice(0, AUDIT_EXCERPT_LENGTH)}…`
        : current.message;
    await this.audit.record(
      actor,
      status === "resolved" ? "ปิดเรื่องแจ้งปัญหา TOR" : "เปิดเรื่องแจ้งปัญหา TOR อีกครั้ง",
      `${tor?.title ?? current.torId.toString()}: ${excerpt}`,
    );
    return toView(updated);
  }

  /** One page of reports, newest first, each with the title of the announcement it is about. */
  async findAll({ status, page, pageSize }: ReportQueryDto) {
    const filter: Filter<TorReportDoc> = status ? { status } : {};
    const [docs, total] = await Promise.all([
      this.db.torReports
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.db.torReports.countDocuments(filter),
    ]);

    const tors = await this.db.tors
      .find({ _id: { $in: [...new Set(docs.map((doc) => doc.torId))] } }, { projection: { title: 1 } })
      .toArray();
    const titles = new Map(tors.map((tor) => [tor._id.toString(), tor.title]));

    return {
      total,
      page,
      pageSize,
      items: docs.map((doc) => ({ ...toView(doc), torTitle: titles.get(doc.torId.toString()) ?? null })),
    };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId, WithId } from "mongodb";

import { SessionPayload } from "../common/token";
import { DatabaseService, TorReportDoc } from "../database/database.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportQueryDto } from "./dto/report-query.dto";

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
  constructor(private readonly db: DatabaseService) {}

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

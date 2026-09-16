import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { mapWithLimit } from "../common/concurrency";
import { USER_AGENT } from "../common/http-client";
import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { READABLE_DOCUMENT_PATTERN, isReadableDocument } from "../tor/tor-documents";
import { TOR_STAGES } from "../tor/tor.constants";
import { AI_REQUEST, EXTRACTION_INSTRUCTION, EXTRACTION_SCHEMA, EXTRACTION_VERSION } from "./ai.constants";
import { ExtractionRunResult, StoredExtraction } from "./ai.types";
import { isUseful, parseExtraction } from "./tor-extraction";
import { VertexClient } from "./vertex.client";

const PDF_MIME = "application/pdf";

/** The stage whose document is worth the least: the bidding is already over. */
const AWARD_STAGE = TOR_STAGES[2];

/**
 * Which of a project's documents is worth reading, best first. They are not
 * equally useful: the draft bidding document carries the scope of work and the
 * bidder qualifications, the invitation carries a summary, and an award notice
 * or a price form is barely more than a number — picking the newest file would
 * land on one of those almost every time.
 *
 * Matched against each portal's own wording: e-GP names its announcements, MEA
 * labels each attachment with the row it sits in (see MeaClient.parseDocuments).
 */
const DOCUMENT_PRIORITY = [
  ["ร่างเอกสารประกวดราคา", "ร่างขอบเขตของงาน", "ร่างประกาศ", "ขอบเขตของงาน", "tor"],
  ["ประกาศเชิญชวน", "ประกวดราคา", "เอกสารดาวน์โหลด", "สำเนาประกาศ"],
] as const;

function documentRank(label: string): number {
  const name = label.toLowerCase();
  const rank = DOCUMENT_PRIORITY.findIndex((terms) => terms.some((term) => name.includes(term)));
  return rank === -1 ? DOCUMENT_PRIORITY.length : rank;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly vertex: VertexClient,
  ) {}

  /**
   * Reads one announcement's document and stores what it says. The result lives
   * under `extraction`, separate from the fields the portal published: one is
   * what an agency stated, the other is what a model read, and a reader has to
   * be able to tell them apart.
   */
  async extractForTor(torId: string): Promise<StoredExtraction> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = await this.db.tors.findOne({ _id: new ObjectId(torId) });
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    const documentUrl = this.documentUrlFor(tor);
    if (!documentUrl) throw new NotFoundException("ประกาศนี้ไม่มีเอกสารให้อ่าน");

    const pdf = await this.fetchPdf(documentUrl);
    const answer = await this.vertex.extractJson<unknown>(
      EXTRACTION_INSTRUCTION,
      this.buildPrompt(tor),
      { data: pdf, mimeType: PDF_MIME },
      EXTRACTION_SCHEMA,
    );

    const extraction = parseExtraction(answer);
    if (!isUseful(extraction)) {
      throw new NotFoundException("อ่านเอกสารแล้วไม่พบรายละเอียดที่ใช้ได้");
    }

    const stored: StoredExtraction = {
      ...extraction,
      model: env.ai.model,
      documentUrl,
      extractedAt: new Date(),
      version: EXTRACTION_VERSION,
    };

    // Clears an earlier failure: the record has just been read, and leaving the
    // note behind would keep showing a problem that no longer exists.
    await this.db.tors.updateOne(
      { _id: tor._id },
      { $set: { extraction: stored }, $unset: { extractionFailure: "" } },
    );
    this.logger.log(`Extracted ${torId} (confidence ${extraction.confidence})`);
    return stored;
  }

  /**
   * Reads everything still unread, newest announcements first, up to this run's
   * call budget. One document failing — a dead link, a scan the model can't
   * read — is recorded on that record and the run carries on; a batch that
   * stopped at the first bad PDF would never get through a backlog.
   */
  async extractPending(limit = AI_REQUEST.maxCallsPerRun): Promise<ExtractionRunResult> {
    const pending = await this.pickPending(limit);

    const result: ExtractionRunResult = { attempted: 0, extracted: 0, skipped: 0, failed: 0 };
    if (pending.length === 0) return result;

    const deadline = Date.now() + AI_REQUEST.runBudgetMs;

    // Reading is nearly all waiting on the model, so a few documents go at
    // once — bounded, because each one is a paid call and the portals serve the
    // PDFs themselves.
    await mapWithLimit(
      pending,
      AI_REQUEST.concurrency,
      () => Date.now() < deadline,
      async ({ _id }) => {
        result.attempted++;
        try {
          await this.extractForTor(_id.toString());
          result.extracted++;
        } catch (error) {
          // "Nothing readable here" is a property of the announcement, not a
          // failure worth blaming on the run.
          if (error instanceof NotFoundException) result.skipped++;
          else result.failed++;
          await this.recordFailure(_id, error);
        }
      },
    );

    if (result.attempted < pending.length) {
      this.logger.warn(
        `Extraction budget spent — ${result.attempted}/${pending.length} read, rest next run`,
      );
    }
    this.logger.log(
      `Extraction run: ${result.extracted} extracted, ${result.skipped} unreadable, ` +
        `${result.failed} failed of ${result.attempted}`,
    );
    return result;
  }

  /**
   * The records this run will read. Announcements a company can still act on
   * come first — their document is the scope of work and the qualifications,
   * the whole reason to read one — and an award notice, which is little more
   * than a winner's name, is only read once nothing open is waiting. Both
   * newest first, so a backlog never starves the fresh arrivals.
   */
  private async pickPending(limit: number): Promise<{ _id: ObjectId }[]> {
    const open = await this.pick(limit, { $ne: AWARD_STAGE });
    return open.length >= limit ? open : [...open, ...(await this.pick(limit - open.length, AWARD_STAGE))];
  }

  private pick(limit: number, stage: Filter<TorDoc>["stage"]): Promise<{ _id: ObjectId }[]> {
    return this.db.tors
      .find(
        { ...this.pendingFilter(), stage },
        { projection: { _id: 1 }, sort: { createdAt: -1 }, limit },
      )
      .toArray();
  }

  /**
   * What is worth spending a model call on. Records with no downloadable file
   * are excluded here rather than tried and failed — e-GP leaves the file path
   * empty on most announcements, and letting those through would spend the
   * run's budget on nothing.
   *
   * A record that already failed waits out a cooldown and is given up on after
   * a few tries. Without that, the newest broken documents would fill every
   * run's budget forever and nothing behind them would ever be read.
   */
  private pendingFilter(): Filter<TorDoc> {
    const retryBefore = new Date(Date.now() - AI_REQUEST.retryAfterMs);

    return {
      "documents.url": { $regex: READABLE_DOCUMENT_PATTERN, $options: "i" },
      // No point spending a model call on an announcement nobody can see.
      deletedAt: { $exists: false },
      $and: [
        {
          $or: [
            { extraction: { $exists: false } },
            { "extraction.version": { $lt: EXTRACTION_VERSION } },
          ],
        },
        {
          $or: [
            { extractionFailure: { $exists: false } },
            {
              "extractionFailure.attempts": { $lt: AI_REQUEST.maxAttempts },
              "extractionFailure.failedAt": { $lt: retryBefore },
            },
          ],
        },
      ],
    };
  }

  /**
   * Marks why a record couldn't be read, and how many runs have tried, so a
   * permanently broken document stops being retried and a person can see what
   * went wrong.
   */
  private async recordFailure(id: ObjectId, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    await this.db.tors.updateOne(
      { _id: id },
      {
        $set: {
          "extractionFailure.reason": reason.slice(0, 500),
          "extractionFailure.failedAt": new Date(),
        },
        $inc: { "extractionFailure.attempts": 1 },
      },
    );
    this.logger.warn(`Extraction failed for ${id.toString()}: ${reason}`);
  }

  /**
   * The document to read. A project publishes several and only some of them are
   * files at all — the rest point at a listing page, which has nothing to
   * extract. The most useful file wins, and among equals the newest, since
   * `documents` is stored newest-first and the sort is stable. `sourceUrl` is
   * the fallback for records imported before the document list existed.
   */
  private documentUrlFor(tor: TorDoc): string | null {
    const files = (tor.documents ?? []).filter((doc) => isReadableDocument(doc.url));
    const best = files.sort((a, b) => documentRank(a.label) - documentRank(b.label))[0];
    if (best) return best.url;

    return tor.sourceUrl && isReadableDocument(tor.sourceUrl) ? tor.sourceUrl : null;
  }

  /**
   * What the portal already knows, given to the model as context — never as
   * something to copy: the point is what the document itself says.
   */
  private buildPrompt(tor: TorDoc): string {
    return [
      `Known title: ${tor.title}`,
      `Known agency: ${tor.agency}`,
      `Known budget: ${tor.budget}`,
      `Known stage: ${tor.stage}`,
      "",
      "The attached PDF is the announcement document — it may be a scan.",
      "<tor_document>(see attached PDF)</tor_document>",
    ].join("\n");
  }

  private async fetchPdf(url: string): Promise<Buffer> {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: PDF_MIME },
      signal: AbortSignal.timeout(AI_REQUEST.timeoutMs),
    });
    if (!res.ok) throw new NotFoundException(`ดาวน์โหลดเอกสารไม่สำเร็จ (${res.status})`);

    // Checked before reading the body: a 50 MB scan is worth refusing at the
    // header, not after it has been pulled down the wire.
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > AI_REQUEST.maxDocumentBytes) {
      throw new NotFoundException(`เอกสารใหญ่เกินกำหนด (${declared} bytes)`);
    }

    // e-GP serves an HTML error page with a 200 when a file is missing, so the
    // content type is checked rather than trusted.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf")) {
      throw new NotFoundException("ลิงก์นี้ไม่ใช่ไฟล์ PDF");
    }

    const pdf = Buffer.from(await res.arrayBuffer());
    // Checked again on the way out: a portal that serves the file without a
    // content-length gets past the header check above, and Vertex would reject
    // the oversized payload after the upload rather than before it.
    if (pdf.byteLength > AI_REQUEST.maxDocumentBytes) {
      throw new NotFoundException(`เอกสารใหญ่เกินกำหนด (${pdf.byteLength} bytes)`);
    }
    return pdf;
  }
}

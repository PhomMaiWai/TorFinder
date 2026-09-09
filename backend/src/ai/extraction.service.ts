import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { AI_REQUEST, EXTRACTION_INSTRUCTION, EXTRACTION_SCHEMA, EXTRACTION_VERSION } from "./ai.constants";
import { ExtractionRunResult, StoredExtraction } from "./ai.types";
import { isUseful, parseExtraction } from "./tor-extraction";
import { VertexClient } from "./vertex.client";

const PDF_MIME = "application/pdf";

/** e-GP serves documents under /api/file/; everything else is a web page. */
const FILE_PATH = "/api/file/";

function isFileUrl(url: string): boolean {
  return url.includes(FILE_PATH);
}

/**
 * Which announcement is worth reading, best first. A project publishes several
 * and they are not equally useful: the draft bidding document carries the scope
 * of work and the bidder qualifications, the invitation carries a summary, and
 * the award notice is barely more than a winner's name — picking the newest
 * file would land on the award notice almost every time.
 */
const DOCUMENT_PRIORITY = [
  ["ร่างเอกสารประกวดราคา", "ร่างขอบเขตของงาน", "tor"],
  ["ประกาศเชิญชวน", "ประกวดราคา"],
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

    await this.db.tors.updateOne({ _id: tor._id }, { $set: { extraction: stored } });
    this.logger.log(`Extracted ${torId} (confidence ${extraction.confidence})`);
    return stored;
  }

  /**
   * Extracts everything that hasn't been read yet, newest announcements first,
   * up to this run's call budget. One document failing — a dead link, a scan
   * the model can't read — is recorded on that record and the run carries on;
   * a batch that stops at the first bad PDF would never get through a backlog.
   */
  async extractPending(limit = AI_REQUEST.maxCallsPerRun): Promise<ExtractionRunResult> {
    // Records without a downloadable file are excluded here rather than tried
    // and failed: e-GP leaves the file path empty on most announcements, and
    // letting those through would spend the run's budget on nothing.
    const pending = await this.db.tors
      .find(
        {
          "documents.url": { $regex: FILE_PATH },
          $or: [
            { extraction: { $exists: false } },
            { "extraction.version": { $lt: EXTRACTION_VERSION } },
          ],
        },
        { projection: { _id: 1 }, sort: { createdAt: -1 }, limit },
      )
      .toArray();

    const result: ExtractionRunResult = { attempted: 0, extracted: 0, skipped: 0, failed: 0 };

    for (const { _id } of pending) {
      result.attempted++;
      try {
        await this.extractForTor(_id.toString());
        result.extracted++;
      } catch (error) {
        // "Nothing readable here" is a property of the announcement, not a
        // failure worth retrying every run.
        if (error instanceof NotFoundException) {
          result.skipped++;
        } else {
          result.failed++;
        }
        await this.recordFailure(_id, error);
      }
    }

    this.logger.log(
      `Extraction run: ${result.extracted} extracted, ${result.failed} failed of ${result.attempted}`,
    );
    return result;
  }

  /**
   * Marks why a record couldn't be read, so a permanently broken document isn't
   * retried on every single run and a person can see what went wrong.
   */
  private async recordFailure(id: ObjectId, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    await this.db.tors.updateOne(
      { _id: id },
      { $set: { extractionFailure: { reason: reason.slice(0, 500), failedAt: new Date() } } },
    );
    this.logger.warn(`Extraction failed for ${id.toString()}: ${reason}`);
  }

  /**
   * The document to read. e-GP publishes several announcements per project and
   * only some of them link to an actual file — the rest point at the project's
   * listing page, which has nothing to extract. The newest real file wins
   * (`documents` is stored newest-first), and `sourceUrl` is the fallback for
   * records imported before the document list existed.
   */
  private documentUrlFor(tor: TorDoc): string | null {
    // Only announcements that actually expose a file can be read; e-GP leaves
    // the file path empty on many of them and the link falls back to a web page.
    const files = (tor.documents ?? []).filter((doc) => isFileUrl(doc.url));
    const best = files.sort((a, b) => documentRank(a.label) - documentRank(b.label))[0];
    if (best) return best.url;

    return tor.sourceUrl && isFileUrl(tor.sourceUrl) ? tor.sourceUrl : null;
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
    const res = await fetch(url, { signal: AbortSignal.timeout(AI_REQUEST.timeoutMs) });
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

    return Buffer.from(await res.arrayBuffer());
  }
}

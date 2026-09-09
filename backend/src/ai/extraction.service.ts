import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { AI_REQUEST, EXTRACTION_INSTRUCTION, EXTRACTION_SCHEMA, EXTRACTION_VERSION } from "./ai.constants";
import { StoredExtraction } from "./ai.types";
import { isUseful, parseExtraction } from "./tor-extraction";
import { VertexClient } from "./vertex.client";

const PDF_MIME = "application/pdf";

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
   * The document to read. Announcements imported from e-GP carry a link to
   * their own file; without one there is nothing to extract from.
   */
  private documentUrlFor(tor: TorDoc): string | null {
    return tor.sourceUrl ?? null;
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

    // e-GP serves an HTML error page with a 200 when a file is missing, so the
    // content type is checked rather than trusted.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf")) {
      throw new NotFoundException("ลิงก์นี้ไม่ใช่ไฟล์ PDF");
    }

    return Buffer.from(await res.arrayBuffer());
  }
}

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { AuditService } from "../audit/audit.service";
import { mapWithLimit } from "../common/concurrency";
import { USER_AGENT } from "../common/http-client";
import { fetchPortalFile } from "../common/portal-fetch";
import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { GprocClient } from "../gproc/gproc.client";
import { PROJECT_NUMBER, gprocProjectUrl } from "../gproc/gproc.constants";
import { MatchingService } from "../matching/matching.service";
import { pickTenderPdfs } from "../common/tender-bundle";
import { readZip, ZipEntry } from "../common/zip";
import { EXTRACTABLE_DOCUMENT_PATTERN, isArchiveDocument, isExtractableDocument } from "../tor/tor-documents";
import { ACTIONABLE_WINDOW_MS, LISTED_TOR, STAGE } from "../tor/tor.constants";
import { AI_REQUEST, EXTRACTION_INSTRUCTION, EXTRACTION_SCHEMA, EXTRACTION_VERSION } from "./ai.constants";
import { ExtractionRunResult, StoredExtraction } from "./ai.types";
import { isUseful, parseExtraction } from "./tor-extraction";
import { VertexClient } from "./vertex.client";

const PDF_MIME = "application/pdf";

const { draft: DRAFT_STAGE, invitation: INVITATION_STAGE } = STAGE;

/** e-GP names each announcement; MEA labels each attachment by its file name. */
const isDraftDocument = (label: string) => /ร่าง|ขอบเขตของงาน|tor/i.test(label);
const isInvitationDocument = (label: string) =>
  /เชิญชวน|สำเนาประกาศ|เอกสารดาวน์โหลด/.test(label) ||
  (/ประกวดราคา/.test(label) && !/ร่าง/.test(label));

/**
 * Which of a project's documents is worth reading for a record at this stage,
 * best first. An invitation is read from the invitation itself — it is the one
 * that names the bid submission day, and a draft read in its place would date
 * the record by a comment window that closed weeks earlier. Every other stage
 * prefers the draft TOR, which carries the full scope and qualifications; an
 * award notice or a price form is barely more than a number.
 */
function documentRanking(stage: TorDoc["stage"]): ((label: string) => boolean)[] {
  return stage === INVITATION_STAGE
    ? [isInvitationDocument, isDraftDocument]
    : [isDraftDocument, isInvitationDocument];
}

/** For the scope and qualifications: the TOR or bidding document, whatever the stage. */
const DETAIL_RANKING = [isDraftDocument, isInvitationDocument];

type LoadedDocument = { pdf: Buffer; label: string; url: string };

function documentRank(label: string, ranking: ((label: string) => boolean)[]): number {
  const rank = ranking.findIndex((matches) => matches(label));
  return rank === -1 ? ranking.length : rank;
}

/**
 * Whether the deadline read from this document is this record's deadline. A
 * draft's date ends public comment; an invitation's ends bidding. Attached to a
 * record at the other stage it would flag the record open or closed on the
 * wrong date, so it is dropped instead — "unknown" is honest, a wrong date isn't.
 */
function deadlineApplies(stage: TorDoc["stage"], label: string): boolean {
  if (stage === DRAFT_STAGE) return !isInvitationDocument(label);
  // Only a document named as a draft is ruled out: MEA names attachments by
  // file ("Attach_TOR_1.pdf"), and those belong to the announcement itself.
  if (stage === INVITATION_STAGE) return !/ร่าง/.test(label);
  return true;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly vertex: VertexClient,
    private readonly gproc: GprocClient,
    private readonly matching: MatchingService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Reads one announcement's document and stores what it says. The result lives
   * under `extraction`, separate from the fields the portal published: one is
   * what an agency stated, the other is what a model read, and a reader has to
   * be able to tell them apart. `actor` is set when an admin asked for this one
   * record; a batch run reads many and is logged once, by whoever started it.
   */
  async extractForTor(torId: string, actor?: string): Promise<StoredExtraction> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = await this.db.tors.findOne({ _id: new ObjectId(torId) });
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");

    const documents = await this.loadDocuments(tor);
    if (documents.length === 0) throw new NotFoundException("ประกาศนี้ไม่มีเอกสารให้อ่าน");

    const answer = await this.vertex.extractJson<unknown>(
      EXTRACTION_INSTRUCTION,
      this.buildPrompt(tor, documents.map((doc) => doc.label)),
      documents.map((doc) => ({ data: doc.pdf, mimeType: PDF_MIME })),
      EXTRACTION_SCHEMA,
    );

    const parsed = parseExtraction(answer);
    const extraction = {
      ...parsed,
      deadline: documents.some((doc) => deadlineApplies(tor.stage, doc.label)) ? parsed.deadline : null,
      // Only a draft states a comment period; a date read off anything else is
      // the bid deadline under another name.
      feedbackDeadline: documents.some((doc) => isDraftDocument(doc.label)) ? parsed.feedbackDeadline : null,
    };
    if (!isUseful(extraction)) {
      throw new NotFoundException("อ่านเอกสารแล้วไม่พบรายละเอียดที่ใช้ได้");
    }

    const stored: StoredExtraction = {
      ...extraction,
      model: env.ai.model,
      // The document a reader should open: the detailed one when there are two.
      documentUrl: documents[documents.length - 1].url,
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
    if (actor) await this.audit.record(actor, "อ่านเอกสาร TOR ด้วย AI", tor.title);
    // What the document asks for can lift a score over a company's line (or rule
    // it out); a project already alerted on isn't alerted again.
    await this.matching
      .notifyMatches([tor._id])
      .catch((error: unknown) => this.logger.warn(`Match notifications after extraction failed: ${String(error)}`));
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
   * The records this run will read: every recent announcement, whatever its
   * stage — an award too, since most of what each import brings in is awards
   * and their page is empty without a summary. The 90-day window keeps the
   * backlog of old awards from spending the quota. Newest first, so a backlog
   * never starves the fresh arrivals.
   */
  private pickPending(limit: number): Promise<{ _id: ObjectId }[]> {
    return this.db.tors
      .find(
        {
          ...this.pendingFilter(),
          createdAt: { $gte: new Date(Date.now() - ACTIONABLE_WINDOW_MS) },
        },
        { projection: { _id: 1 }, sort: { createdAt: -1 }, limit },
      )
      .toArray();
  }

  /**
   * What is worth spending a model call on: a record with a file to read or an
   * e-GP project number to fetch one by. Records with neither
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
      // No point spending a model call on an announcement nobody can see.
      ...LISTED_TOR,
      $and: [
        {
          $or: [
            // A PDF, or a bundle (MEA's) with the PDFs inside.
            { "documents.url": { $regex: EXTRACTABLE_DOCUMENT_PATTERN, $options: "i" } },
            // process5 has no file URL; its invitation is fetched by project number.
            { sourceRef: { $regex: "^gproc:" }, stage: INVITATION_STAGE },
            // Any portal's record that names its e-GP project: the national e-GP
            // bundles the TOR for it, whatever the agency's own site attached.
            { projectNumber: { $regex: PROJECT_NUMBER.source } },
          ],
        },
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
   * What the model reads, in the order the prompt names it. An invitation's bid
   * date comes from the national e-GP's signed copy — rendered from what the
   * agency published, where a city portal's attachment can be the unfilled
   * template. That notice is one page, though: who may bid and what the work
   * is are in the TOR, so the TOR is read alongside it in the same call.
   */
  private async loadDocuments(tor: TorDoc): Promise<LoadedDocument[]> {
    const loaded: LoadedDocument[] = [];
    let room = AI_REQUEST.maxDocumentBytes;

    if (tor.stage === INVITATION_STAGE && tor.projectNumber && PROJECT_NUMBER.test(tor.projectNumber)) {
      const signed = await this.gproc.invitationPdf(tor.projectNumber).catch(() => null);
      if (signed && signed.byteLength <= room) {
        loaded.push({ pdf: signed, label: "ประกาศเชิญชวน (e-GP กรมบัญชีกลาง)", url: gprocProjectUrl(tor.projectNumber) });
        room -= signed.byteLength;
      }
    }

    // Who may bid and what the work is: the bidding document and TOR the
    // national e-GP bundles for every e-bidding. An award reads it too: its own
    // notice names the winner and the price, not the work.
    if (tor.projectNumber && PROJECT_NUMBER.test(tor.projectNumber)) {
      const tender = await this.gproc.tenderDocuments(tor.projectNumber, room).catch(() => []);
      for (const doc of tender) {
        loaded.push({ ...doc, url: gprocProjectUrl(tor.projectNumber) });
        room -= doc.pdf.byteLength;
      }
      if (tender.length) return loaded;
    }

    // With the invitation in hand, the detail is what is still missing.
    const ranking = loaded.length ? DETAIL_RANKING : documentRanking(tor.stage);
    const file = this.documentFor(tor, ranking);
    // A second copy of the same notice adds cost and nothing else; a bundle
    // carries the TOR whatever it is named.
    if (!file || (loaded.length && !isDraftDocument(file.label) && !isArchiveDocument(file.url))) return loaded;

    try {
      if (isArchiveDocument(file.url)) {
        const bundled = await this.bundleDocuments(tor, file, room);
        if (bundled.length === 0) throw new NotFoundException("ไม่พบไฟล์ PDF ที่อ่านได้ในชุดเอกสาร");
        loaded.push(...bundled);
      } else {
        const pdf = await this.fetchPdf(file.url);
        if (pdf.byteLength <= room) loaded.push({ pdf, ...file });
      }
    } catch (error) {
      // The invitation alone still yields the date; with nothing read, fail.
      if (loaded.length === 0) throw error;
    }
    return loaded;
  }

  /**
   * The document to read — a PDF, or a bundle to take the PDFs out of. A
   * project publishes several and only some of them are files at all — the rest point at a listing page, which has nothing to
   * extract. The most useful file for this record's stage wins, and among
   * equals the newest, since `documents` is stored newest-first and the sort is
   * stable. `sourceUrl` is the fallback for records imported before the
   * document list existed.
   */
  private documentFor(
    tor: TorDoc,
    ranking: ((label: string) => boolean)[],
  ): { url: string; label: string } | null {
    const best = (tor.documents ?? [])
      .filter((doc) => isExtractableDocument(doc.url))
      .sort((a, b) => documentRank(a.label, ranking) - documentRank(b.label, ranking))[0];
    if (best) return { url: best.url, label: best.label };

    return tor.sourceUrl && isExtractableDocument(tor.sourceUrl)
      ? { url: tor.sourceUrl, label: tor.stage }
      : null;
  }

  /**
   * What the portal already knows, given to the model as context — never as
   * something to copy: the point is what the document itself says. The
   * document's own name tells the model which deadline it is looking for.
   */
  private buildPrompt(tor: TorDoc, documentLabels: string[]): string {
    return [
      `Known title: ${tor.title}`,
      `Known agency: ${tor.agency}`,
      `Known budget: ${tor.budget}`,
      `Known stage: ${tor.stage}`,
      "Attached documents, in order:",
      ...documentLabels.map((label, i) => `${i + 1}. ${label}`),
      "",
      "The attached PDFs are the announcement documents — any of them may be a scan.",
      "<tor_document>(see attached PDFs)</tor_document>",
    ].join("\n");
  }

  /**
   * The bidding document and TOR out of a zipped bundle — MEA posts every
   * announcement's documents as one zip of the same files e-GP generates. They
   * are labelled by the stage the bundle belongs to, since the labels decide
   * which deadline the answer is trusted for: a draft bundle's date ends public
   * comment, an invitation's ends bidding.
   */
  private async bundleDocuments(
    tor: TorDoc,
    file: { url: string; label: string },
    room: number,
  ): Promise<LoadedDocument[]> {
    const draft = tor.stage === DRAFT_STAGE || /ร่าง|WORK_DRAFT/i.test(`${file.label} ${file.url}`);
    const prefix = draft ? "ร่าง" : "";
    let entries: ZipEntry[];
    try {
      entries = readZip(await this.fetchBundle(file.url));
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException("เปิดชุดเอกสารนี้ไม่ได้");
    }
    const picked = await pickTenderPdfs(entries, room, {
      bidding: `${prefix}เอกสารประกวดราคา (${file.label})`,
      tor: `${prefix}ขอบเขตของงาน TOR (${file.label})`,
    });
    return picked.map(({ label, pdf }) => ({ label, pdf, url: file.url }));
  }

  private async fetchBundle(url: string): Promise<Buffer> {
    // Allowlisted host, redirects checked hop by hop (ASVS 1.3.6, 15.3.2).
    const res = await fetchPortalFile(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(AI_REQUEST.timeoutMs),
    });
    if (!res.ok) throw new NotFoundException(`ดาวน์โหลดชุดเอกสารไม่สำเร็จ (${res.status})`);
    if (Number(res.headers.get("content-length") ?? 0) > AI_REQUEST.maxBundleBytes) {
      await res.body?.cancel();
      throw new NotFoundException("ชุดเอกสารใหญ่เกินกำหนด");
    }

    const zip = Buffer.from(await res.arrayBuffer());
    if (zip.byteLength > AI_REQUEST.maxBundleBytes) throw new NotFoundException("ชุดเอกสารใหญ่เกินกำหนด");
    // A portal error page arrives with a 200 too; only a real zip goes further.
    if (zip.subarray(0, 4).toString("latin1") !== "PK\x03\x04") throw new NotFoundException("ลิงก์นี้ไม่ใช่ไฟล์ zip");
    return zip;
  }

  private async fetchPdf(url: string): Promise<Buffer> {
    // Allowlisted host, redirects checked hop by hop (ASVS 1.3.6, 15.3.2).
    const res = await fetchPortalFile(url, {
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

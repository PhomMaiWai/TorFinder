import { BadGatewayException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

import { USER_AGENT } from "../common/http-client";
import { DatabaseService } from "../database/database.service";
import { isViewableDocument, VIEWABLE_CONTENT_TYPES } from "./tor-documents";

/** Past this, a "document" is a scan nobody reads in a browser tab; it stays a link to the portal. */
const MAX_DOCUMENT_BYTES = 40 * 1024 * 1024;
/** Covers the whole transfer, not just the first byte: a stalled portal mustn't hold a connection open. */
const TRANSFER_TIMEOUT_MS = 60_000;

export type OpenedDocument = {
  body: Readable;
  /** One of VIEWABLE_CONTENT_TYPES — never the portal's raw header. */
  contentType: string;
  filename: string;
  /** Absent when the portal doesn't declare it; the response is then chunked. */
  length?: number;
};

/**
 * Relays an announcement's own file (a PDF, or a scan posted as an image) from the portal that published it, so the
 * detail page can show it in place instead of sending the reader away.
 *
 * Only files already recorded on the announcement can be opened, addressed by
 * position — never a URL from the caller — so this can't be used to make the
 * server fetch arbitrary addresses. The file is streamed through, never held
 * in memory, and the portal request is dropped the moment the reader leaves.
 */
@Injectable()
export class TorDocumentService {
  constructor(private readonly db: DatabaseService) {}

  async open(torId: string, index: number, signal: AbortSignal): Promise<OpenedDocument> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");

    const tor = await this.db.tors.findOne({ _id: new ObjectId(torId) }, { projection: { documents: 1 } });
    const file = tor?.documents?.[index];
    if (!file || !isViewableDocument(file.url)) throw new NotFoundException("เอกสารนี้เปิดบนเว็บไม่ได้");

    const res = await fetch(file.url, {
      headers: { "User-Agent": USER_AGENT, Accept: VIEWABLE_CONTENT_TYPES.join(", ") },
      signal: AbortSignal.any([signal, AbortSignal.timeout(TRANSFER_TIMEOUT_MS)]),
    }).catch(() => {
      throw new BadGatewayException("เชื่อมต่อเว็บต้นทางไม่สำเร็จ");
    });

    if (!res.ok || !res.body) throw new BadGatewayException(`เว็บต้นทางตอบกลับ ${res.status}`);
    // e-GP answers a missing file with an HTML page and a 200, so the type is
    // checked, not trusted — and only a known-safe type is ever passed on.
    const declaredType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const contentType = VIEWABLE_CONTENT_TYPES.find((type) => type === declaredType);
    if (!contentType) {
      await res.body.cancel();
      throw new NotFoundException("ลิงก์นี้ไม่ใช่ไฟล์เอกสาร");
    }

    const declared = Number(res.headers.get("content-length")) || undefined;
    if (declared && declared > MAX_DOCUMENT_BYTES) {
      await res.body.cancel();
      throw new PayloadTooLargeException("เอกสารใหญ่เกินกว่าจะแสดงบนเว็บ");
    }

    return {
      body: Readable.fromWeb(res.body as ReadableStream<Uint8Array>),
      contentType,
      filename: decodeURIComponent(file.url.split("?")[0].split("/").pop() || "document.pdf"),
      length: declared,
    };
  }
}

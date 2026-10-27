import { BadGatewayException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { ArchiveFile, ArchiveFileData, readShowableFile, showableFiles } from "../common/archive-files";
import { USER_AGENT } from "../common/http-client";
import { TtlCache } from "../common/ttl-cache";
import { readZip, ZipEntry } from "../common/zip";
import { DatabaseService } from "../database/database.service";
import { isArchiveDocument } from "./tor-documents";

/** MEA bundles run to about a megabyte; anything far past this isn't a document bundle. */
const MAX_ARCHIVE_BYTES = 40 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
/** Someone opening a bundle usually opens several files in it within minutes. */
const ARCHIVE_TTL_MS = 15 * 60 * 1000;
const ARCHIVES_KEPT = 6;

/**
 * Opens a zipped bundle an announcement links to and serves the files inside
 * one at a time, so a reader sees the TOR rather than a download prompt. The
 * bundle is fetched once and kept briefly; a file is only inflated when asked
 * for, and only if its first bytes say it is the PDF or image it claims to be.
 */
@Injectable()
export class TorArchiveService {
  private readonly archives = new TtlCache<string, Promise<ZipEntry[]>>(ARCHIVE_TTL_MS, ARCHIVES_KEPT);

  constructor(private readonly db: DatabaseService) {}

  async entries(torId: string, index: number): Promise<ArchiveFile[]> {
    return showableFiles(await this.open(torId, index));
  }

  async file(torId: string, index: number, position: number): Promise<ArchiveFileData> {
    return readShowableFile(await this.open(torId, index), position);
  }

  private async open(torId: string, index: number): Promise<ZipEntry[]> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = await this.db.tors.findOne({ _id: new ObjectId(torId) }, { projection: { documents: 1 } });
    const url = tor?.documents?.[index]?.url;
    if (!url || !isArchiveDocument(url)) throw new NotFoundException("เอกสารนี้ไม่ใช่ชุดไฟล์");

    // Keyed by URL, not position: the same bundle linked from two records is fetched once.
    return this.archives.getOrLoad(url, () => this.download(url));
  }

  private async download(url: string): Promise<ZipEntry[]> {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    }).catch(() => {
      throw new BadGatewayException("เชื่อมต่อเว็บต้นทางไม่สำเร็จ");
    });
    if (!res.ok) throw new BadGatewayException(`เว็บต้นทางตอบกลับ ${res.status}`);
    if (Number(res.headers.get("content-length")) > MAX_ARCHIVE_BYTES) {
      await res.body?.cancel();
      throw new PayloadTooLargeException("ชุดเอกสารใหญ่เกินกว่าจะเปิดบนเว็บ");
    }

    const zip = Buffer.from(await res.arrayBuffer());
    if (zip.byteLength > MAX_ARCHIVE_BYTES) throw new PayloadTooLargeException("ชุดเอกสารใหญ่เกินกว่าจะเปิดบนเว็บ");
    // A portal error page arrives with a 200 too; only a real zip goes further.
    if (zip.subarray(0, 4).toString("latin1") !== "PK\x03\x04") throw new NotFoundException("ลิงก์นี้ไม่ใช่ไฟล์ zip");
    try {
      return readZip(zip);
    } catch {
      throw new NotFoundException("เปิดชุดเอกสารนี้ไม่ได้");
    }
  }
}

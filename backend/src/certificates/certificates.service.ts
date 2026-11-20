import { Readable } from "node:stream";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ObjectId } from "mongodb";

import { cleanUploadIsolated } from "../common/parse-worker";
import { scanForViruses } from "../common/virus-scan";
import { DatabaseService } from "../database/database.service";
import {
  CERTIFICATE_LIMITS,
  CertificateFile,
  CertificateFileType,
  CertificateRecord,
} from "./certificate.types";
import { CertificateDto } from "./dto/certificate.dto";

/** What multer hands over with memory storage — only the parts read here. */
export type UploadedCertificateFile = { buffer: Buffer; originalname: string; size: number };

const NOT_FOUND = "ไม่พบใบรับรองนี้";
const NO_PROFILE = "ไม่พบโปรไฟล์บริษัท";

/**
 * The file's type from its first bytes. The name and the browser's
 * Content-Type are both whatever the uploader says; the bytes are what a
 * reader's viewer will actually open.
 */
export function sniffCertificateFile(buffer: Buffer): CertificateFileType | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  return null;
}

/** A display name only: no path, no control characters, and short enough for a header. */
export function safeFileName(name: string, type: CertificateFileType): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 120);
  const extension = type === "application/pdf" ? ".pdf" : type === "image/png" ? ".png" : ".jpg";
  const stem = base.replace(/\.[^.]*$/, "") || "certificate";
  return `${stem}${extension}`;
}

/**
 * A company's certificates (#260), kept on its own profile so matching reads
 * them with the rest of it. Every operation is scoped to the signed-in
 * account: a record or file is only ever found inside that account's own
 * list, so there is no id another company could guess its way into.
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Null until the company has answered — not the same as "none". */
  async list(userId: string): Promise<CertificateRecord[] | null> {
    const company = await this.companyOf(userId);
    return company.certificates ?? null;
  }

  async create(userId: string, dto: CertificateDto): Promise<CertificateRecord> {
    this.checkDates(dto);
    const now = new Date();
    const record: CertificateRecord = { id: new ObjectId().toHexString(), ...this.fieldsOf(dto), createdAt: now, updatedAt: now };

    const result = await this.db.users.updateOne(
      {
        _id: this.idOf(userId),
        company: { $exists: true },
        // The length check and the push are one atomic step, so two tabs can't overshoot the limit.
        [`company.certificates.${CERTIFICATE_LIMITS.records - 1}`]: { $exists: false },
      },
      { $push: { "company.certificates": record } },
    );
    if (result.matchedCount === 0) {
      await this.companyOf(userId);
      throw new ConflictException(`บันทึกใบรับรองได้สูงสุด ${CERTIFICATE_LIMITS.records} รายการ`);
    }
    return record;
  }

  async update(userId: string, id: string, dto: CertificateDto): Promise<CertificateRecord> {
    this.checkDates(dto);
    const current = await this.recordOf(userId, id);
    const next: CertificateRecord = {
      ...this.fieldsOf(dto),
      id: current.id,
      ...(current.file ? { file: current.file } : {}),
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };
    await this.replace(userId, id, next);
    return next;
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.recordOf(userId, id);
    await this.db.users.updateOne(
      { _id: this.idOf(userId) },
      { $pull: { "company.certificates": { id } } },
    );
    if (record.file) await this.deleteFile(record.file);
  }

  /** The answer "we hold none". Only when the list is empty — it never drops records. */
  async answerNone(userId: string): Promise<CertificateRecord[]> {
    const company = await this.companyOf(userId);
    if (company.certificates?.length) return company.certificates;
    await this.db.users.updateOne({ _id: this.idOf(userId) }, { $set: { "company.certificates": [] } });
    return [];
  }

  async attachFile(userId: string, id: string, upload: UploadedCertificateFile | undefined): Promise<CertificateRecord> {
    if (!upload?.buffer?.length) throw new BadRequestException("กรุณาเลือกไฟล์ใบรับรอง");
    // Multer already refuses anything larger; this keeps the rule true without it.
    if (upload.size > CERTIFICATE_LIMITS.fileBytes) throw new BadRequestException("ไฟล์ใหญ่เกิน 5 MB");

    const type = sniffCertificateFile(upload.buffer);
    if (!type) throw new UnsupportedMediaTypeException("รับเฉพาะไฟล์ PDF, PNG หรือ JPG");
    await scanForViruses(upload.buffer, { source: "certificate", userId });

    // Images: pixel-size cap and metadata stripped (ASVS 5.2.6, 14.2.8).
    const content = await cleanUploadIsolated(upload.buffer, type);
    const current = await this.recordOf(userId, id);
    const name = safeFileName(upload.originalname, type);

    const fileId = new ObjectId();
    await new Promise<void>((resolve, reject) => {
      Readable.from(content)
        .pipe(
          this.db.certificateFiles.openUploadStreamWithId(fileId, name, {
            metadata: { userId: this.idOf(userId), certificateId: id, contentType: type },
          }),
        )
        .on("finish", () => resolve())
        .on("error", reject);
    });

    const file: CertificateFile = { id: fileId.toHexString(), name, contentType: type, size: content.length, uploadedAt: new Date() };
    const next: CertificateRecord = { ...current, file, updatedAt: new Date() };
    try {
      await this.replace(userId, id, next);
    } catch (error) {
      await this.deleteFile(file);
      throw error;
    }
    // The old scan goes once the new one is in place, never before.
    if (current.file) await this.deleteFile(current.file);
    return next;
  }

  async removeFile(userId: string, id: string): Promise<CertificateRecord> {
    const current = await this.recordOf(userId, id);
    if (!current.file) return current;
    const { file, ...rest } = current;
    const next: CertificateRecord = { ...rest, updatedAt: new Date() };
    await this.replace(userId, id, next);
    await this.deleteFile(file);
    return next;
  }

  /** The owner's own file, ready to stream back. */
  async openFile(userId: string, id: string): Promise<{ file: CertificateFile; stream: Readable }> {
    const { file } = await this.recordOf(userId, id);
    if (!file) throw new NotFoundException("ใบรับรองนี้ยังไม่มีไฟล์แนบ");
    return { file, stream: this.db.certificateFiles.openDownloadStream(new ObjectId(file.id)) };
  }

  private fieldsOf(dto: CertificateDto): Omit<CertificateRecord, "id" | "file" | "createdAt" | "updatedAt"> {
    // Only the fields that were given: a stored `undefined` would read back as null.
    return Object.fromEntries(
      Object.entries({
        name: dto.name,
        standard: dto.standard,
        issuer: dto.issuer,
        issuedAt: dto.issuedAt,
        expiresAt: dto.expiresAt,
        verifyUrl: dto.verifyUrl,
        scope: dto.scope,
      }).filter(([, value]) => value !== undefined && value !== null),
    ) as Omit<CertificateRecord, "id" | "file" | "createdAt" | "updatedAt">;
  }

  private checkDates({ issuedAt, expiresAt }: CertificateDto): void {
    for (const date of [issuedAt, expiresAt]) {
      // The pattern lets 2026-02-31 through; a real calendar date round-trips.
      if (date && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        throw new BadRequestException(`ไม่มีวันที่ ${date} ในปฏิทิน`);
      }
    }
    if (issuedAt && expiresAt && expiresAt < issuedAt) {
      throw new BadRequestException("วันหมดอายุต้องไม่ก่อนวันที่ออกใบรับรอง");
    }
  }

  private async replace(userId: string, id: string, record: CertificateRecord): Promise<void> {
    const result = await this.db.users.updateOne(
      { _id: this.idOf(userId), "company.certificates.id": id },
      { $set: { "company.certificates.$": record } },
    );
    if (result.matchedCount === 0) throw new NotFoundException(NOT_FOUND);
  }

  private async deleteFile(file: CertificateFile): Promise<void> {
    try {
      await this.db.certificateFiles.delete(new ObjectId(file.id));
    } catch (error) {
      // An orphaned scan is harmless — nothing links to it any more — so a
      // failed clean-up must not fail the request that caused it.
      this.logger.warn(`Could not delete certificate file ${file.id}: ${(error as Error).message}`);
    }
  }

  private async recordOf(userId: string, id: string): Promise<CertificateRecord> {
    const company = await this.companyOf(userId);
    const record = company.certificates?.find((candidate) => candidate.id === id);
    if (!record) throw new NotFoundException(NOT_FOUND);
    return record;
  }

  private async companyOf(userId: string) {
    const user = await this.db.users.findOne({ _id: this.idOf(userId) }, { projection: { company: 1 } });
    if (!user?.company) throw new NotFoundException(NO_PROFILE);
    return user.company;
  }

  private idOf(userId: string): ObjectId {
    if (!ObjectId.isValid(userId)) throw new NotFoundException(NO_PROFILE);
    return new ObjectId(userId);
  }
}

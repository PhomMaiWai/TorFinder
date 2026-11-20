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

import { bangkokToday } from "../certificates/certificate.types";
import {
  MAX_STORED_FILE_BYTES,
  STORED_FILE_TYPES,
  StoredFile,
  UploadedFile,
  deleteStoredFile,
  readStoredFile,
  safeFileName,
  sniffFileType,
  storeFile,
} from "../common/stored-files";
import { cleanUploadIsolated } from "../common/parse-worker";
import { scanForViruses } from "../common/virus-scan";
import { writeZip } from "../common/zip-writer";
import { CompanyProfile, DatabaseService } from "../database/database.service";
import { Coverage, coverageOf } from "./coverage";
import { PastProjectDto, TeamMemberDto } from "./dto/library.dto";
import { LIBRARY_KINDS, LIBRARY_LIMITS, LibraryKind, LibraryRecord, PastProject, TeamMember } from "./library.types";
import { CHECKLIST_NAME, PackFile, checklistHtml, planFiles } from "./starter-pack";

const NO_PROFILE = "ไม่พบโปรไฟล์บริษัท";
const NO_TOR = "ไม่พบประกาศนี้";

/** Reference letters and contracts are scans; CVs are often Word documents. */
const LIBRARY_FILE_TYPES = [
  STORED_FILE_TYPES.pdf,
  STORED_FILE_TYPES.png,
  STORED_FILE_TYPES.jpeg,
  STORED_FILE_TYPES.docx,
] as const;

type LibraryDto = PastProjectDto | TeamMemberDto;

/**
 * The proposal library (#259). Records live on the company's own profile,
 * beside its certificates, and every operation is scoped to the signed-in
 * account: a record or file is only ever looked up inside that account's own
 * list, so there is no id another company could reach.
 */
@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(userId: string) {
    const company = await this.companyOf(userId);
    return {
      pastProjects: company.pastProjects ?? [],
      teamMembers: company.teamMembers ?? [],
      certificates: company.certificates ?? [],
    };
  }

  async create(userId: string, kind: LibraryKind, dto: LibraryDto): Promise<LibraryRecord> {
    this.checkDates(dto);
    const { field, noun } = LIBRARY_KINDS[kind];
    const now = new Date();
    const record = { id: new ObjectId().toHexString(), ...fieldsOf(dto), createdAt: now, updatedAt: now } as LibraryRecord;

    const result = await this.db.users.updateOne(
      {
        _id: this.idOf(userId),
        company: { $exists: true },
        // The length check and the push are one atomic step.
        [`company.${field}.${LIBRARY_LIMITS.records - 1}`]: { $exists: false },
      },
      { $push: { [`company.${field}`]: record } },
    );
    if (result.matchedCount === 0) {
      await this.companyOf(userId);
      throw new ConflictException(`บันทึก${noun}ได้สูงสุด ${LIBRARY_LIMITS.records} รายการ`);
    }
    return record;
  }

  async update(userId: string, kind: LibraryKind, id: string, dto: LibraryDto): Promise<LibraryRecord> {
    this.checkDates(dto);
    const current = await this.recordOf(userId, kind, id);
    const next = {
      ...fieldsOf(dto),
      id: current.id,
      ...(current.file ? { file: current.file } : {}),
      createdAt: current.createdAt,
      updatedAt: new Date(),
    } as LibraryRecord;
    await this.replace(userId, kind, next);
    return next;
  }

  async remove(userId: string, kind: LibraryKind, id: string): Promise<void> {
    const record = await this.recordOf(userId, kind, id);
    await this.db.users.updateOne(
      { _id: this.idOf(userId) },
      { $pull: { [`company.${LIBRARY_KINDS[kind].field}`]: { id } } },
    );
    if (record.file) await deleteStoredFile(this.db.libraryFiles, record.file.id, this.logger);
  }

  async attachFile(userId: string, kind: LibraryKind, id: string, upload: UploadedFile | undefined): Promise<LibraryRecord> {
    if (!upload?.buffer?.length) throw new BadRequestException("กรุณาเลือกไฟล์");
    if (upload.size > MAX_STORED_FILE_BYTES) throw new BadRequestException("ไฟล์ใหญ่เกิน 5 MB");

    const type = sniffFileType(upload.buffer, LIBRARY_FILE_TYPES);
    if (!type) throw new UnsupportedMediaTypeException("รับเฉพาะไฟล์ PDF, Word (.docx), PNG หรือ JPG");
    await scanForViruses(upload.buffer, { source: `library-${kind}`, userId });

    // Images: pixel-size cap and metadata stripped (ASVS 5.2.6, 14.2.8).
    const content = await cleanUploadIsolated(upload.buffer, type);
    const current = await this.recordOf(userId, kind, id);
    const name = safeFileName(upload.originalname, type, kind === "team" ? "cv" : "reference");
    const fileId = await storeFile(this.db.libraryFiles, content, name, {
      userId: this.idOf(userId),
      kind,
      recordId: id,
      contentType: type,
    });

    const file: StoredFile = { id: fileId.toHexString(), name, contentType: type, size: content.length, uploadedAt: new Date() };
    const next = { ...current, file, updatedAt: new Date() } as LibraryRecord;
    try {
      await this.replace(userId, kind, next);
    } catch (error) {
      await deleteStoredFile(this.db.libraryFiles, file.id, this.logger);
      throw error;
    }
    // The old file goes once the new one is in place, never before.
    if (current.file) await deleteStoredFile(this.db.libraryFiles, current.file.id, this.logger);
    return next;
  }

  async removeFile(userId: string, kind: LibraryKind, id: string): Promise<LibraryRecord> {
    const current = await this.recordOf(userId, kind, id);
    if (!current.file) return current;
    const { file, ...rest } = current;
    const next = { ...rest, updatedAt: new Date() } as LibraryRecord;
    await this.replace(userId, kind, next);
    await deleteStoredFile(this.db.libraryFiles, file.id, this.logger);
    return next;
  }

  async openFile(userId: string, kind: LibraryKind, id: string): Promise<{ file: StoredFile; stream: Readable }> {
    const { file } = await this.recordOf(userId, kind, id);
    if (!file) throw new NotFoundException("รายการนี้ยังไม่มีไฟล์แนบ");
    return { file, stream: this.db.libraryFiles.openDownloadStream(new ObjectId(file.id)) };
  }

  /** "4 of 7 ready": the TOR's qualifications, each checked against this company's library. */
  async coverage(userId: string, torId: string): Promise<Coverage & { extracted: boolean }> {
    const [company, tor] = await Promise.all([this.companyOf(userId), this.torOf(torId)]);
    const qualifications = tor.extraction?.qualifications ?? [];
    return {
      extracted: Boolean(tor.extraction),
      ...coverageOf(qualifications, company, { torTitle: tor.title }),
    };
  }

  /**
   * A ZIP to start the bid from: the checklist, and the files behind the
   * evidence it cites. Files that would push it past the size cap are left
   * out and named in the checklist instead.
   */
  async starterPack(userId: string, torId: string): Promise<{ name: string; zip: Buffer }> {
    const [company, tor] = await Promise.all([this.companyOf(userId), this.torOf(torId)]);
    const coverage = coverageOf(tor.extraction?.qualifications ?? [], company, { torTitle: tor.title });
    const library = {
      certificates: company.certificates ?? [],
      pastProjects: company.pastProjects ?? [],
      teamMembers: company.teamMembers ?? [],
    };

    const included: PackFile[] = [];
    const skipped: PackFile[] = [];
    let bytes = 0;
    for (const planned of planFiles(coverage, library)) {
      if (bytes + planned.file.size > LIBRARY_LIMITS.packBytes) skipped.push(planned);
      else {
        included.push(planned);
        bytes += planned.file.size;
      }
    }

    const files: { name: string; data: Buffer }[] = [];
    for (const planned of included) {
      const bucket = planned.bucket === "certificate" ? this.db.certificateFiles : this.db.libraryFiles;
      try {
        files.push({ name: planned.path, data: await readStoredFile(bucket, planned.file.id) });
      } catch (error) {
        this.logger.warn(`Starter pack left out ${planned.file.id}: ${(error as Error).message}`);
        skipped.push(planned);
      }
    }
    const kept = included.filter((planned) => !skipped.includes(planned));

    const html = checklistHtml(
      { title: tor.title, agency: tor.agency, projectNumber: tor.projectNumber, sourceUrl: tor.sourceUrl },
      coverage,
      library,
      { included: kept, skipped, generatedAt: bangkokToday() },
    );
    files.unshift({ name: CHECKLIST_NAME, data: Buffer.from(html, "utf8") });

    const reference = tor.projectNumber?.replace(/[^\w-]/g, "") || torId;
    return { name: `starter-pack-${reference}.zip`, zip: writeZip(files) };
  }

  private checkDates(dto: LibraryDto): void {
    const dates = "startedAt" in dto ? [dto.startedAt, dto.completedAt] : [];
    for (const date of dates) {
      if (date && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        throw new BadRequestException(`ไม่มีวันที่ ${date} ในปฏิทิน`);
      }
    }
    if ("startedAt" in dto && dto.startedAt && dto.completedAt && dto.completedAt < dto.startedAt) {
      throw new BadRequestException("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
    }
  }

  private async replace(userId: string, kind: LibraryKind, record: LibraryRecord): Promise<void> {
    const field = LIBRARY_KINDS[kind].field;
    const result = await this.db.users.updateOne(
      { _id: this.idOf(userId), [`company.${field}.id`]: record.id },
      { $set: { [`company.${field}.$`]: record } },
    );
    if (result.matchedCount === 0) throw new NotFoundException(`ไม่พบ${LIBRARY_KINDS[kind].noun}นี้`);
  }

  private async recordOf(userId: string, kind: LibraryKind, id: string): Promise<LibraryRecord> {
    const company = await this.companyOf(userId);
    const list: (PastProject | TeamMember)[] = (kind === "projects" ? company.pastProjects : company.teamMembers) ?? [];
    const record = list.find((candidate) => candidate.id === id);
    if (!record) throw new NotFoundException(`ไม่พบ${LIBRARY_KINDS[kind].noun}นี้`);
    return record;
  }

  private async companyOf(userId: string): Promise<CompanyProfile> {
    const user = await this.db.users.findOne({ _id: this.idOf(userId) }, { projection: { company: 1 } });
    if (!user?.company) throw new NotFoundException(NO_PROFILE);
    return user.company;
  }

  private async torOf(torId: string) {
    if (!ObjectId.isValid(torId)) throw new NotFoundException(NO_TOR);
    const tor = await this.db.tors.findOne(
      { _id: new ObjectId(torId) },
      { projection: { title: 1, agency: 1, projectNumber: 1, sourceUrl: 1, "extraction.qualifications": 1 } },
    );
    if (!tor) throw new NotFoundException(NO_TOR);
    return tor;
  }

  private idOf(userId: string): ObjectId {
    if (!ObjectId.isValid(userId)) throw new NotFoundException(NO_PROFILE);
    return new ObjectId(userId);
  }
}

/** Only the fields that were given: a stored `undefined` would read back as null. */
function fieldsOf(dto: LibraryDto): Record<string, unknown> {
  return Object.fromEntries(Object.entries({ ...dto }).filter(([, value]) => value !== undefined && value !== null));
}

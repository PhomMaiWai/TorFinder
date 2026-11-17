import { Readable } from "node:stream";

import { Logger } from "@nestjs/common";
import { GridFSBucket, ObjectId } from "mongodb";

import { readZip } from "./zip";

/**
 * Files a company keeps with its own records — certificate scans, CVs,
 * reference letters. Shared by every module that stores one, so the rules
 * for what is accepted and how it is served back exist once.
 */

export const STORED_FILE_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export type StoredFileType = (typeof STORED_FILE_TYPES)[keyof typeof STORED_FILE_TYPES];

const EXTENSIONS: Record<StoredFileType, string> = {
  [STORED_FILE_TYPES.pdf]: ".pdf",
  [STORED_FILE_TYPES.png]: ".png",
  [STORED_FILE_TYPES.jpeg]: ".jpg",
  [STORED_FILE_TYPES.docx]: ".docx",
};

/** What a stored file looks like on the record that owns it. */
export type StoredFile = {
  /** GridFS file id. */
  id: string;
  /** The name it was uploaded under, for the download. */
  name: string;
  contentType: StoredFileType;
  size: number;
  uploadedAt: Date;
};

/** What multer hands over with memory storage — only the parts read here. */
export type UploadedFile = { buffer: Buffer; originalname: string; size: number };

/** A scan or a CV is a few pages; 5 MB is generous. */
export const MAX_STORED_FILE_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** A Word document is a ZIP; only one whose parts say Word counts, not any archive renamed .docx. */
function isWordDocument(buffer: Buffer): boolean {
  try {
    const names = new Set(readZip(buffer).map((entry) => entry.name));
    return names.has("[Content_Types].xml") && names.has("word/document.xml");
  } catch {
    return false;
  }
}

/**
 * The file's type from its own bytes, among those `allowed`. The name and the
 * browser's Content-Type are both whatever the uploader says; the bytes are
 * what a reader's viewer will actually open.
 */
export function sniffFileType(buffer: Buffer, allowed: readonly StoredFileType[]): StoredFileType | null {
  let type: StoredFileType | null = null;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") type = STORED_FILE_TYPES.pdf;
  else if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) type = STORED_FILE_TYPES.png;
  else if (buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) type = STORED_FILE_TYPES.jpeg;
  else if (buffer.subarray(0, 4).equals(ZIP_SIGNATURE) && allowed.includes(STORED_FILE_TYPES.docx) && isWordDocument(buffer)) {
    type = STORED_FILE_TYPES.docx;
  }
  return type && allowed.includes(type) ? type : null;
}

/** A display name only: no path, no control characters, short enough for a header, and the real extension. */
export function safeFileName(name: string, type: StoredFileType, fallback = "file"): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 120);
  const stem = base.replace(/\.[^.]*$/, "") || fallback;
  return `${stem}${EXTENSIONS[type]}`;
}

export async function storeFile(
  bucket: GridFSBucket,
  buffer: Buffer,
  name: string,
  metadata: Record<string, unknown>,
): Promise<ObjectId> {
  const id = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer)
      .pipe(bucket.openUploadStreamWithId(id, name, { metadata }))
      .on("finish", () => resolve())
      .on("error", reject);
  });
  return id;
}

/**
 * An orphaned file is harmless — nothing links to it any more — so a failed
 * clean-up is logged, never thrown into the request that caused it.
 */
export async function deleteStoredFile(bucket: GridFSBucket, id: string, logger: Logger): Promise<void> {
  try {
    await bucket.delete(new ObjectId(id));
  } catch (error) {
    logger.warn(`Could not delete stored file ${id}: ${(error as Error).message}`);
  }
}

export async function readStoredFile(bucket: GridFSBucket, id: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(new ObjectId(id))) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Download headers: always an attachment, so an uploaded file never runs in our origin. */
export function downloadHeaders(file: Pick<StoredFile, "name" | "contentType" | "size">): Record<string, string> {
  const extension = file.name.slice(file.name.lastIndexOf("."));
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").trim();
  const fallback = ascii.length > extension.length ? ascii : `file${extension}`;
  return {
    "Content-Type": file.contentType,
    "Content-Length": String(file.size),
    "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

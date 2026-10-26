import { NotFoundException, PayloadTooLargeException } from "@nestjs/common";

import { baseName, documentLabel, documentRank } from "./document-labels";
import { ZipEntry } from "./zip";

/** Per file inside a bundle, checked before inflating — a zip's declared sizes are untrusted. */
const MAX_ENTRY_BYTES = 40 * 1024 * 1024;

/** The file types worth showing, told apart by their first bytes rather than their names. */
const TYPES = [
  { extension: /\.pdf$/i, contentType: "application/pdf", magic: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { extension: /\.jpe?g$/i, contentType: "image/jpeg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 },
  { extension: /\.png$/i, contentType: "image/png", magic: (b: Buffer) => b.subarray(1, 4).toString("latin1") === "PNG" },
] as const;

/** One showable file in a bundle; `entry` is its position, which is how it is asked for. */
export type ArchiveFile = { entry: number; name: string; label: string; size: number };

export type ArchiveFileData = { data: Buffer; contentType: string; filename: string };

/** The PDFs and images in a bundle, project documents first and standard forms after. */
export function showableFiles(entries: ZipEntry[]): ArchiveFile[] {
  return entries
    .flatMap((entry, position) =>
      entry.size > 0 && TYPES.some((type) => type.extension.test(entry.name))
        ? [{ entry: position, name: baseName(entry.name), label: documentLabel(entry.name), size: entry.size }]
        : [],
    )
    .sort((a, b) => documentRank(a.name) - documentRank(b.name));
}

/** One file out of a bundle, only if its first bytes say it is the PDF or image it claims to be. */
export function readShowableFile(entries: ZipEntry[], position: number): ArchiveFileData {
  const entry = entries[position];
  const type = entry && TYPES.find((candidate) => candidate.extension.test(entry.name));
  if (!entry || !type) throw new NotFoundException("ไม่พบไฟล์นี้ในชุดเอกสาร");
  if (entry.size > MAX_ENTRY_BYTES) throw new PayloadTooLargeException("ไฟล์ใหญ่เกินกว่าจะแสดงบนเว็บ");

  let data: Buffer;
  try {
    data = entry.read();
  } catch {
    throw new NotFoundException("เปิดไฟล์นี้ในชุดเอกสารไม่ได้");
  }
  if (!type.magic(data)) throw new NotFoundException("ไฟล์นี้ไม่ใช่เอกสารตามที่ระบุ");
  return { data, contentType: type.contentType, filename: baseName(entry.name) };
}

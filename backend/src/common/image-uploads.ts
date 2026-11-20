import { BadRequestException } from "@nestjs/common";

import { cleanDocx, cleanPdf } from "./document-metadata";

/**
 * Checks and cleans an uploaded PNG or JPEG before it is stored, with no
 * image library: only the container's own structure is read, the pixels are
 * never decoded.
 *
 * - ASVS 5.2.6: refuses images whose stated size is too large, so a small file
 *   that claims a huge canvas (a "pixel flood") never reaches whoever opens it.
 * - ASVS 14.2.8: drops metadata a company may not mean to share — camera and
 *   GPS EXIF, XMP, IPTC, text chunks and comments. What a viewer needs to draw
 *   the image correctly (JFIF, ICC colour profile, Adobe colour transform) stays.
 *
 * A file whose structure can't be followed is refused rather than stored as is.
 */

/** A 600 dpi A4 scan is about 5,000 × 7,000; this leaves room and still stops a flood. */
export const MAX_IMAGE_PIXELS = 50_000_000;
export const MAX_IMAGE_SIDE = 20_000;

const PNG_SIGNATURE_LENGTH = 8;
/** PNG chunks that only carry metadata: text, compressed text, international text, EXIF, modification time. */
const PNG_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** JPEG segments that only carry metadata: APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), COM. */
const JPEG_METADATA_MARKERS = new Set([0xe1, 0xed, 0xfe]);
/** Start-of-frame markers, which hold the dimensions (C4, C8 and CC are other tables). */
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;

const BROKEN = "ไฟล์รูปภาพเสียหายหรืออ่านไม่ได้ กรุณาบันทึกไฟล์ใหม่แล้วลองอีกครั้ง";
const TOO_LARGE = `รูปภาพมีขนาดพิกเซลใหญ่เกินไป (สูงสุด ${MAX_IMAGE_SIDE.toLocaleString("en-US")} พิกเซลต่อด้าน และ ${(MAX_IMAGE_PIXELS / 1_000_000).toFixed(0)} ล้านพิกเซล)`;

export type ImageDimensions = { width: number; height: number };

function assertReasonable({ width, height }: ImageDimensions): void {
  if (width <= 0 || height <= 0) throw new BadRequestException(BROKEN);
  if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw new BadRequestException(TOO_LARGE);
  }
}

/** The PNG with its metadata chunks left out, and its dimensions. Chunks are copied whole, CRC included. */
export function cleanPng(buffer: Buffer): { buffer: Buffer; dimensions: ImageDimensions } {
  const kept: Buffer[] = [buffer.subarray(0, PNG_SIGNATURE_LENGTH)];
  let offset = PNG_SIGNATURE_LENGTH;
  let dimensions: ImageDimensions | null = null;
  let ended = false;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new BadRequestException(BROKEN);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new BadRequestException(BROKEN);

    if (offset === PNG_SIGNATURE_LENGTH) {
      // IHDR must come first and hold width and height.
      if (type !== "IHDR" || length < 8) throw new BadRequestException(BROKEN);
      dimensions = { width: buffer.readUInt32BE(offset + 8), height: buffer.readUInt32BE(offset + 12) };
    }
    if (!PNG_METADATA_CHUNKS.has(type)) kept.push(buffer.subarray(offset, end));
    offset = end;
    if (type === "IEND") {
      ended = true;
      break; // anything after IEND is not part of the image
    }
  }

  if (!dimensions || !ended) throw new BadRequestException(BROKEN);
  assertReasonable(dimensions);
  return { buffer: Buffer.concat(kept), dimensions };
}

/** The JPEG with its metadata segments left out, and its dimensions. Everything from the scan on is copied as is. */
export function cleanJpeg(buffer: Buffer): { buffer: Buffer; dimensions: ImageDimensions } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new BadRequestException(BROKEN);
  const kept: Buffer[] = [buffer.subarray(0, 2)];
  let offset = 2;
  let dimensions: ImageDimensions | null = null;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new BadRequestException(BROKEN);
    // Any number of 0xFF fill bytes may come before a marker.
    let markerAt = offset;
    while (markerAt < buffer.length && buffer[markerAt] === 0xff) markerAt++;
    if (markerAt >= buffer.length) throw new BadRequestException(BROKEN);
    const marker = buffer[markerAt];
    const segmentStart = markerAt - 1;

    if (marker === JPEG_EOI) {
      kept.push(buffer.subarray(segmentStart, markerAt + 1));
      break;
    }
    if (markerAt + 3 > buffer.length) throw new BadRequestException(BROKEN);
    const length = buffer.readUInt16BE(markerAt + 1);
    const end = markerAt + 1 + length;
    if (length < 2 || end > buffer.length) throw new BadRequestException(BROKEN);

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) throw new BadRequestException(BROKEN);
      dimensions = { height: buffer.readUInt16BE(markerAt + 4), width: buffer.readUInt16BE(markerAt + 6) };
    }
    if (marker === JPEG_SOS) {
      // The entropy-coded data has no length field; the rest of the file is
      // the image (and any further scans), so it is kept whole.
      kept.push(buffer.subarray(segmentStart));
      break;
    }
    if (!JPEG_METADATA_MARKERS.has(marker)) kept.push(buffer.subarray(segmentStart, end));
    offset = end;
  }

  if (!dimensions) throw new BadRequestException(BROKEN);
  assertReasonable(dimensions);
  return { buffer: Buffer.concat(kept), dimensions };
}

/**
 * What to store for an upload whose type has already been sniffed, with its
 * metadata removed (ASVS 14.2.8): an image checked and cleaned here, a PDF or
 * Word document by document-metadata.ts.
 */
export function cleanUpload(buffer: Buffer, contentType: string): Buffer {
  if (contentType === "image/png") return cleanPng(buffer).buffer;
  if (contentType === "image/jpeg") return cleanJpeg(buffer).buffer;
  if (contentType === "application/pdf") return cleanPdf(buffer);
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return cleanDocx(buffer);
  return buffer;
}

import { BadRequestException } from "@nestjs/common";
import { deflateRawSync, inflateSync } from "node:zlib";

import { readZip } from "./zip";

/**
 * ASVS 14.2.8: who wrote a document, on what, and when, is removed before it
 * is stored. Images are cleaned in image-uploads.ts; this does PDF and Word.
 *
 * PDF, without a PDF library: every byte offset in a PDF's cross-reference
 * table must stay valid, so nothing is removed, only overwritten with
 * something of exactly the same length.
 * - A document-information dictionary (the one with /Author, /Creator,
 *   /Producer, /CreationDate or /ModDate) has every string value in it
 *   replaced by spaces: `(Jane Doe)` becomes `(        )`.
 * - An XMP metadata stream (`/Type /Metadata`) is replaced by an empty XMP
 *   packet padded with spaces.
 * - Either one may sit inside a Flate-compressed stream (an object stream,
 *   or compressed XMP). That stream is inflated, cleaned the same way and
 *   compressed again to exactly its old length (see deflateToLength).
 * Old revisions are cleaned too: every object in the file is looked at, not
 * only the ones the latest trailer points to. An encrypted PDF can't be read
 * this way and is refused.
 *
 * Word (.docx): `docProps/core.xml` (author, last modified by, dates,
 * revision) and `docProps/app.xml` (company, manager, application, editing
 * time) are rewritten empty, `docProps/custom.xml` is emptied, any other
 * `docProps/` part loses its text, and every other part is copied unchanged.
 * Not touched: names inside the document's own content, such as comment
 * authors and tracked-change authors, which are part of what was written.
 */

const UNREADABLE = "อ่านไฟล์ PDF นี้ไม่ได้ กรุณาบันทึกเป็น PDF ใหม่แล้วลองอีกครั้ง";
const ENCRYPTED = "ไฟล์ PDF ที่ตั้งรหัสผ่านหรือเข้ารหัสไว้อัปโหลดไม่ได้ กรุณาบันทึกเป็น PDF ปกติแล้วลองอีกครั้ง";
/** A real CV or reference letter unpacks to a few MB; 50 MB of parts is not one. */
export const MAX_DOCX_UNPACKED_BYTES = 50 * 1024 * 1024;

const BAD_DOCX = "อ่านไฟล์ Word นี้ไม่ได้ กรุณาบันทึกใหม่แล้วลองอีกครั้ง";

/** Keys only a document-information dictionary has together; an outline item or annotation has none of these. */
const INFO_KEYS = ["/Author", "/Creator", "/Producer", "/CreationDate", "/ModDate"];

/** A valid XMP packet that says nothing; readers expect the rdf:RDF element even when it is empty. */
const EMPTY_XMP =
  '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta><?xpacket end="w"?>';

const isDelimiter = (byte: number) =>
  byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09 || byte === 0x0c || byte === 0x00 ||
  byte === 0x28 || byte === 0x29 || byte === 0x3c || byte === 0x3e || byte === 0x5b || byte === 0x5d ||
  byte === 0x7b || byte === 0x7d || byte === 0x2f || byte === 0x25;

/** Index just after the literal string that opens at `start` (a `(`), honouring nesting and escapes. */
function endOfLiteral(data: Buffer, start: number, end: number): number {
  let depth = 0;
  for (let i = start; i < end; i++) {
    const byte = data[i];
    if (byte === 0x5c) i++; // backslash escapes the next byte
    else if (byte === 0x28) depth++;
    else if (byte === 0x29 && --depth === 0) return i + 1;
  }
  throw new BadRequestException(UNREADABLE);
}

/** Overwrites every string (literal or hex) in data[start, end) with a same-length `( … )` of spaces. */
function blankStrings(data: Buffer, start: number, end: number): void {
  for (let i = start; i < end; i++) {
    const byte = data[i];
    let close = -1;
    if (byte === 0x28) close = endOfLiteral(data, i, end);
    else if (byte === 0x3c && data[i + 1] !== 0x3c && (i === 0 || data[i - 1] !== 0x3c)) {
      close = data.indexOf(0x3e, i);
      if (close < 0 || close >= end) throw new BadRequestException(UNREADABLE);
      close += 1;
    } else if (byte === 0x3c) {
      i++; // `<<`: a dictionary, not a hex string
      continue;
    }
    if (close < 0) continue;
    data[i] = 0x28;
    data.fill(0x20, i + 1, close - 1);
    data[close - 1] = 0x29;
    i = close - 1;
  }
}

/** Whether data[start, end) holds `key` as a whole PDF name. */
function hasName(data: Buffer, start: number, end: number, key: string): boolean {
  for (let at = data.indexOf(key, start, "latin1"); at >= 0 && at < end; at = data.indexOf(key, at + 1, "latin1")) {
    if (at + key.length >= end || isDelimiter(data[at + key.length])) return true;
  }
  return false;
}

const isInfoDictionary = (data: Buffer, start: number, end: number) =>
  INFO_KEYS.some((key) => hasName(data, start, end, key)) && !hasName(data, start, end, "/Parent") && !hasName(data, start, end, "/Type");

const isMetadataStream = (data: Buffer, start: number, end: number) =>
  /\/Type\s*\/Metadata\b/.test(data.toString("latin1", start, end));

/** The integer value of `/Length` in a stream dictionary, when it is written directly. */
function directLength(dictionary: string): number | null {
  const match = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dictionary);
  return match ? Number(match[1]) : null;
}

/** RFC 1950 Adler-32, the checksum at the end of a zlib stream. */
function adler32(data: Buffer): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * A zlib stream of exactly `length` bytes that inflates to `content` followed
 * by spaces. The content is compressed with a sync flush (byte-aligned, not
 * final), then the stream is finished with stored blocks of spaces sized so
 * the whole thing fills the old stream's slot. Trailing spaces are harmless
 * after the last object of an object stream and after an XMP packet. Null if
 * the cleaned content no longer fits.
 */
function deflateToLength(content: Buffer, length: number): Buffer | null {
  const body = deflateRawSync(content, { level: 9, finishFlush: 2 /* Z_SYNC_FLUSH */ });
  // What the stored blocks must fill: everything but the 2-byte zlib header,
  // the compressed body and the 4-byte checksum. Each block is 5 header bytes
  // plus up to 65535 bytes of spaces, and there must be at least one.
  const remaining = length - 2 - body.length - 4;
  if (remaining < 5) return null;
  const count = Math.ceil(remaining / (5 + 65535));
  let spaces = remaining - 5 * count;
  const blocks: Buffer[] = [];
  for (let n = 0; n < count; n++) {
    const size = n === count - 1 ? spaces : Math.min(65535, spaces);
    blocks.push(storedBlock(size, n === count - 1));
    spaces -= size;
  }
  const inflated = Buffer.concat([content, Buffer.alloc(remaining - 5 * count, 0x20)]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(inflated));
  const out = Buffer.concat([Buffer.from([0x78, 0xda]), body, ...blocks, checksum]);
  return out.length === length ? out : null;
}

function storedBlock(size: number, final: boolean): Buffer {
  const block = Buffer.alloc(5 + size, 0x20);
  block[0] = final ? 0x01 : 0x00;
  block.writeUInt16LE(size, 1);
  block.writeUInt16LE(~size & 0xffff, 3);
  return block;
}

/** Cleans the objects inside an inflated object stream; true if anything changed. */
function cleanObjectStream(content: Buffer, dictionary: string): boolean {
  const count = Number(/\/N\s+(\d+)/.exec(dictionary)?.[1]);
  const first = Number(/\/First\s+(\d+)/.exec(dictionary)?.[1]);
  if (!Number.isInteger(count) || !Number.isInteger(first)) throw new BadRequestException(UNREADABLE);
  const offsets = content
    .toString("latin1", 0, first)
    .trim()
    .split(/\s+/)
    .filter((_, index) => index % 2 === 1)
    .map(Number);
  let changed = false;
  for (let n = 0; n < offsets.length; n++) {
    const start = first + offsets[n];
    const end = n + 1 < offsets.length ? first + offsets[n + 1] : content.length;
    if (isInfoDictionary(content, start, end)) {
      blankStrings(content, start, end);
      changed = true;
    }
  }
  return changed;
}

/** Replaces an XMP packet with an empty one, padded to the same length. */
function emptyXmp(length: number): Buffer {
  return length >= EMPTY_XMP.length ? Buffer.from(EMPTY_XMP.padEnd(length, " "), "latin1") : Buffer.alloc(length, 0x20);
}

export function cleanPdf(input: Buffer): Buffer {
  const data = Buffer.from(input);
  const text = data.toString("latin1");
  if (/\/Encrypt\s/.test(text.slice(-4096)) || /\/Encrypt\s+\d+\s+\d+\s+R/.test(text)) {
    throw new BadRequestException(ENCRYPTED);
  }

  const objectHeader = /(?<!\d)\d+\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = objectHeader.exec(text))) {
    const bodyStart = match.index + match[0].length;
    const streamAt = text.indexOf("stream", bodyStart);
    const endobjAt = text.indexOf("endobj", bodyStart);
    // An object that never ends can't be checked, so the file isn't stored.
    if (endobjAt < 0) throw new BadRequestException(UNREADABLE);

    if (streamAt < 0 || streamAt > endobjAt) {
      // A plain object: clean it if it is a document-information dictionary.
      if (isInfoDictionary(data, bodyStart, endobjAt)) blankStrings(data, bodyStart, endobjAt);
      objectHeader.lastIndex = endobjAt;
      continue;
    }

    // A stream object: find its data from /Length (or the endstream keyword).
    const dictionary = text.slice(bodyStart, streamAt);
    let dataStart = streamAt + "stream".length;
    if (text[dataStart] === "\r") dataStart++;
    if (text[dataStart] === "\n") dataStart++;
    const declared = directLength(dictionary);
    const endstreamAt = text.indexOf("endstream", declared !== null ? dataStart + declared : dataStart);
    if (endstreamAt < 0) throw new BadRequestException(UNREADABLE);
    let dataEnd = declared !== null ? dataStart + declared : endstreamAt;
    if (declared === null) while (dataEnd > dataStart && (data[dataEnd - 1] === 0x0a || data[dataEnd - 1] === 0x0d)) dataEnd--;
    const nextEndobj = text.indexOf("endobj", endstreamAt);
    if (nextEndobj < 0) throw new BadRequestException(UNREADABLE);
    objectHeader.lastIndex = nextEndobj;

    const isObjectStream = /\/Type\s*\/ObjStm\b/.test(dictionary);
    const isXmp = isMetadataStream(data, bodyStart, streamAt);
    if (!isObjectStream && !isXmp) continue;

    const filter = /\/Filter\s*(?:\[\s*)?\/(\w+)/.exec(dictionary)?.[1];
    if (filter === undefined) {
      if (isXmp) emptyXmp(dataEnd - dataStart).copy(data, dataStart);
      else cleanObjectStream(data.subarray(dataStart, dataEnd), dictionary);
      continue;
    }
    // Only plain Flate (no predictor, no second filter) can be rewritten in place.
    if (filter !== "FlateDecode" || /\/DecodeParms|\/Filter\s*\[\s*\/\w+\s*\//.test(dictionary)) {
      throw new BadRequestException(UNREADABLE);
    }
    let content: Buffer;
    try {
      content = inflateSync(data.subarray(dataStart, dataEnd));
    } catch {
      throw new BadRequestException(UNREADABLE);
    }
    const changed = isXmp ? true : cleanObjectStream(content, dictionary);
    if (!changed) continue;
    const cleaned = isXmp ? Buffer.from(EMPTY_XMP, "latin1") : content;
    const replacement = deflateToLength(cleaned, dataEnd - dataStart);
    if (!replacement) throw new BadRequestException(UNREADABLE);
    replacement.copy(data, dataStart);
  }
  return data;
}

const CORE_PROPERTIES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>';
const APP_PROPERTIES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>';
const CUSTOM_PROPERTIES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>';

const REPLACED_PARTS: Record<string, string> = {
  "docProps/core.xml": CORE_PROPERTIES,
  "docProps/app.xml": APP_PROPERTIES,
  "docProps/custom.xml": CUSTOM_PROPERTIES,
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A document-properties part, emptied: the three standard ones replaced, any
 * other (e.g. a writer's own `docProps/meta.xml` naming the software) keeps
 * its elements but loses their text. Every other part is unchanged.
 */
function cleanPart(name: string, content: Buffer): Buffer {
  if (REPLACED_PARTS[name] !== undefined) return Buffer.from(REPLACED_PARTS[name], "utf8");
  if (name.startsWith("docProps/") && name.endsWith(".xml")) {
    return Buffer.from(content.toString("utf8").replace(/>[^<]+</g, "><"), "utf8");
  }
  return content;
}

/** A Word document with its document properties emptied; every other part unchanged. */
export function cleanDocx(input: Buffer): Buffer {
  let entries;
  try {
    const parts = readZip(input);
    // A zip bomb dressed as a Word file is refused before anything is inflated.
    if (parts.reduce((sum, part) => sum + part.size, 0) > MAX_DOCX_UNPACKED_BYTES) throw new Error("too large");
    entries = parts.map((entry) => ({ name: entry.name, content: cleanPart(entry.name, entry.read()) }));
  } catch {
    throw new BadRequestException(BAD_DOCX);
  }

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, content } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0x00210000, 10); // fixed DOS time/date (1980-01-01): no upload time is kept either
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0x00210000, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

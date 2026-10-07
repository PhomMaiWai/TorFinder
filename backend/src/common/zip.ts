import { inflateRawSync } from "node:zlib";

/**
 * Just enough of the ZIP format to take files out of the document bundles the
 * national e-GP publishes: stored and deflated entries, no ZIP64, no
 * encryption. A dependency for this would be heavier than the format.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
/** The end record is 22 bytes plus a comment of at most 64 KiB. */
const MAX_TAIL = 22 + 0xffff;
const UTF8_NAMES = 0x0800;

const STORED = 0;
const DEFLATED = 8;

export type ZipEntry = {
  name: string;
  size: number;
  /** Decompresses on demand, refusing to grow past `size` — a bundle is untrusted input. */
  read(): Buffer;
};

export function readZip(zip: Buffer): ZipEntry[] {
  const tailStart = Math.max(0, zip.length - MAX_TAIL);
  let end = -1;
  for (let i = zip.length - 22; i >= tailStart; i--) {
    if (zip.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip archive");

  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(at) !== CENTRAL_FILE_HEADER) throw new Error("corrupt zip directory");
    const flags = zip.readUInt16LE(at + 8);
    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localOffset = zip.readUInt32LE(at + 42);
    const rawName = zip.subarray(at + 46, at + 46 + nameLength);
    const name = rawName.toString(flags & UTF8_NAMES ? "utf8" : "latin1");
    at += 46 + nameLength + extraLength + commentLength;

    if (method !== STORED && method !== DEFLATED) continue;
    entries.push({
      name,
      size,
      read() {
        if (zip.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) throw new Error("corrupt zip entry");
        const dataStart =
          localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
        const data = zip.subarray(dataStart, dataStart + compressedSize);
        return method === STORED ? Buffer.from(data) : inflateRawSync(data, { maxOutputLength: size });
      },
    });
  }
  return entries;
}

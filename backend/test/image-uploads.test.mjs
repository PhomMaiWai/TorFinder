// Unit coverage for uploaded-image checks (ASVS 5.2.6 pixel floods, 14.2.8
// metadata). Imported from the compiled build (run after `npm run build`).

import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { describe, it } from "node:test";

import { cleanJpeg, cleanPng, cleanUpload } from "../dist/common/image-uploads.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, extraChunks = []) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    ...extraChunks,
    chunk("IDAT", deflateSync(Buffer.alloc(1 + width))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function segment(marker, data) {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([head, data]);
}

function jpeg(width, height, extraSegments = []) {
  const sof = Buffer.alloc(9);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof.set([1, 1, 0x11, 0], 5);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    ...extraSegments,
    segment(0xc0, sof),
    segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]), // scan data, including a stuffed 0xFF00
    Buffer.from([0xff, 0xd9]),
  ]);
}

describe("cleanPng", () => {
  it("keeps the image and drops text, EXIF and time chunks", () => {
    const original = png(4, 3, [
      chunk("tEXt", Buffer.from("Author\0Somchai", "latin1")),
      chunk("eXIf", Buffer.from("GPS 13.75,100.50", "latin1")),
      chunk("tIME", Buffer.alloc(7)),
    ]);
    const { buffer, dimensions } = cleanPng(original);
    assert.deepEqual(dimensions, { width: 4, height: 3 });
    assert.deepEqual(buffer, png(4, 3));
    assert.ok(!buffer.includes("Somchai"));
    assert.ok(!buffer.includes("GPS"));
  });

  it("refuses a pixel flood: a small file claiming a huge canvas", () => {
    assert.throws(() => cleanPng(png(30_000, 30_000)), /พิกเซล/);
    assert.throws(() => cleanPng(png(10_000, 6_000)), /พิกเซล/); // 60 MP
  });

  it("refuses a truncated or IHDR-less file instead of storing it", () => {
    const whole = png(4, 3);
    assert.throws(() => cleanPng(whole.subarray(0, whole.length - 6)));
    assert.throws(() => cleanPng(Buffer.concat([PNG_SIGNATURE, chunk("IEND", Buffer.alloc(0))])));
  });
});

describe("cleanJpeg", () => {
  it("keeps JFIF and the scan, drops EXIF, IPTC and comments", () => {
    const original = jpeg(640, 480, [
      segment(0xe1, Buffer.from("Exif\0\0GPS 13.75,100.50", "latin1")),
      segment(0xed, Buffer.from("Photoshop 3.0 Somchai", "latin1")),
      segment(0xfe, Buffer.from("scanned at home", "latin1")),
      segment(0xe2, Buffer.from("ICC_PROFILE\0", "latin1")),
    ]);
    const { buffer, dimensions } = cleanJpeg(original);
    assert.deepEqual(dimensions, { width: 640, height: 480 });
    assert.ok(!buffer.includes("GPS"));
    assert.ok(!buffer.includes("Somchai"));
    assert.ok(!buffer.includes("scanned"));
    assert.ok(buffer.includes("ICC_PROFILE"), "the colour profile is kept");
    assert.ok(buffer.includes("JFIF"));
    assert.deepEqual(buffer.subarray(-7), Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]));
  });

  it("refuses a pixel flood", () => {
    assert.throws(() => cleanJpeg(jpeg(65_000, 65_000)), /พิกเซล/);
  });

  it("refuses a JPEG with no frame header or a broken segment", () => {
    assert.throws(() => cleanJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 1, 2])));
    assert.throws(() => cleanJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0])));
  });
});

describe("cleanUpload", () => {
  // PDF and Word metadata is removed too (ASVS 14.2.8; test/document-metadata.test.mjs).
  it("returns a PDF with no metadata byte for byte, as a copy", () => {
    const pdf = Buffer.from("%PDF-1.7\n%%EOF");
    const cleaned = cleanUpload(pdf, "application/pdf");
    assert.deepEqual(cleaned, pdf);
    assert.notEqual(cleaned, pdf, "the caller's buffer is never modified in place");
  });

  it("strips a PDF's author", () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Author (Somchai) /Producer (x) >>\nendobj\n%%EOF", "latin1");
    const cleaned = cleanUpload(pdf, "application/pdf");
    assert.equal(cleaned.length, pdf.length);
    assert.ok(!cleaned.toString("latin1").includes("Somchai"));
  });
});

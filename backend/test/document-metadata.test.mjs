// Unit coverage for ASVS 14.2.8 and 15.2.5: PDF and Word uploads lose their
// metadata (author, software, dates) before they are stored, without moving a
// single byte a PDF reader relies on; and the parsing runs in a worker thread.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deflateRawSync, deflateSync, inflateSync } from "node:zlib";

import { MAX_DOCX_UNPACKED_BYTES, cleanDocx, cleanPdf } from "../dist/common/document-metadata.js";
import { cleanUploadIsolated, runParseTask } from "../dist/common/parse-worker.js";
import { readZip } from "../dist/common/zip.js";

const SECRETS = ["Somchai", "Secret Producer", "Arun Digital", "HiddenTitle"];
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A small PDF with a classic xref table; `objects` are the bodies of objects 1…n. */
function classicPdf(objects, trailerExtra = "") {
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Every offset in a classic xref table still starts its object. */
function assertOffsetsIntact(pdf) {
  const text = pdf.toString("latin1");
  const table = text.slice(text.lastIndexOf("xref\n"));
  const rows = [...table.matchAll(/^(\d{10}) \d{5} n /gm)].map((m) => Number(m[1]));
  rows.forEach((offset, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, offset), `object ${i + 1} moved`));
}

const PAGE_OBJECTS = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
  "<< /Length 21 >>\nstream\nBT (Visible text) Tj ET\nendstream",
];

describe("cleanPdf (ASVS 14.2.8)", () => {
  it("blanks every value of the document-information dictionary, keeping every offset", () => {
    const info =
      "<< /Author (Somchai Jaidee) /Producer (Secret Producer 1.0) /Title (HiddenTitle \\(v2\\)) " +
      "/Creator <FEFF0041007200750E> /Company (Arun Digital) /CreationDate (D:20261120120000+07'00') >>";
    const pdf = classicPdf([...PAGE_OBJECTS, info], "/Info 5 0 R ");
    const clean = cleanPdf(pdf);

    assert.equal(clean.length, pdf.length);
    assertOffsetsIntact(clean);
    const text = clean.toString("latin1");
    for (const secret of SECRETS) assert.ok(!text.includes(secret), `${secret} left in the file`);
    assert.ok(!text.includes("FEFF0041"), "hex strings are blanked too");
    assert.ok(text.includes("BT (Visible text) Tj ET"), "page content is untouched");
    assert.ok(text.includes("/Type /Page /Parent 2 0 R"), "other objects are untouched");
  });

  it("leaves an outline item's /Title alone: only information dictionaries are metadata", () => {
    const outline = "<< /Title (Chapter one) /Parent 2 0 R /Author (not info: has a Parent) >>";
    const clean = cleanPdf(classicPdf([...PAGE_OBJECTS, outline])).toString("latin1");
    assert.ok(clean.includes("(Chapter one)"));
  });

  it("replaces an uncompressed XMP stream with an empty packet of the same length", () => {
    const xmp =
      '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Somchai Jaidee</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
    const pdf = classicPdf([...PAGE_OBJECTS, `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>\nstream\n${xmp}\nendstream`]);
    const clean = cleanPdf(pdf);
    assert.equal(clean.length, pdf.length);
    assertOffsetsIntact(clean);
    const text = clean.toString("latin1");
    assert.ok(!text.includes("Somchai"));
    assert.ok(text.includes("<rdf:RDF"), "still a valid XMP packet");
  });

  it("cleans an information dictionary inside a compressed object stream, to the stream's exact length", () => {
    const info = "<< /Author (Somchai Jaidee) /Producer (Secret Producer) >>";
    const other = "<< /Note (keep me) >>";
    const header = `9 0 10 ${info.length} `;
    const content = Buffer.from(header + info + other, "latin1");
    // Padded so the cleaned stream, which compresses better, still fits.
    const compressed = deflateSync(Buffer.concat([content, Buffer.alloc(64, 0x20)]), { level: 1 });
    const objstm = `<< /Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`;
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.5\n5 0 obj\n" + objstm, "latin1"),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1"),
    ]);

    const clean = cleanPdf(pdf);
    assert.equal(clean.length, pdf.length);
    const start = clean.indexOf("stream\n") + "stream\n".length;
    const inflated = inflateSync(clean.subarray(start, start + compressed.length)).toString("latin1");
    assert.ok(!inflated.includes("Somchai") && !inflated.includes("Secret Producer"));
    assert.ok(inflated.startsWith(header), "the object stream's index is unchanged");
    assert.ok(inflated.includes("(keep me)"), "other objects in the stream are kept");
  });

  it("refuses an encrypted PDF and one with an object that never ends", () => {
    assert.throws(() => cleanPdf(classicPdf(PAGE_OBJECTS, "/Encrypt 9 0 R ")), (error) => error.getStatus() === 400);
    assert.throws(() => cleanPdf(Buffer.from("%PDF-1.4\n1 0 obj << /Author (x")), (error) => error.getStatus() === 400);
  });
});

/** A minimal .docx: the parts given, deflated. */
function zip(parts) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const content = Buffer.from(text, "utf8");
    const data = deflateRawSync(content);
    const nameBytes = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(parts).length, 8);
  end.writeUInt16LE(Object.keys(parts).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const WORD_PARTS = {
  "[Content_Types].xml": "<Types/>",
  "word/document.xml": "<w:document><w:t>Quarterly report</w:t></w:document>",
  "docProps/core.xml": "<cp:coreProperties><dc:creator>Somchai Jaidee</dc:creator><cp:lastModifiedBy>Somchai</cp:lastModifiedBy></cp:coreProperties>",
  "docProps/app.xml": "<Properties><Company>Arun Digital</Company><Application>Secret Producer</Application></Properties>",
  "docProps/meta.xml": "<meta><generator>Secret Producer 2.0</generator></meta>",
};

describe("cleanDocx (ASVS 14.2.8)", () => {
  it("empties the document properties and keeps the document itself", () => {
    const entries = readZip(cleanDocx(zip(WORD_PARTS)));
    const parts = Object.fromEntries(entries.map((entry) => [entry.name, entry.read().toString("utf8")]));
    assert.deepEqual(Object.keys(parts), Object.keys(WORD_PARTS), "every part kept, in order");
    assert.equal(parts["word/document.xml"], WORD_PARTS["word/document.xml"]);
    for (const [name, text] of Object.entries(parts)) {
      for (const secret of SECRETS) assert.ok(!text.includes(secret), `${secret} left in ${name}`);
    }
    assert.match(parts["docProps/meta.xml"], /<generator><\/generator>/);
  });

  it("refuses a Word file that claims to unpack to more than the cap", () => {
    const bomb = zip(WORD_PARTS);
    // Rewrite one entry's declared size in the central directory.
    const central = bomb.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bomb.writeUInt32LE(MAX_DOCX_UNPACKED_BYTES + 1, central + 24);
    assert.throws(() => cleanDocx(bomb), (error) => error.getStatus() === 400);
  });
});

describe("parse worker (ASVS 15.2.5)", () => {
  it("cleans an upload in a worker thread", async () => {
    const pdf = classicPdf([...PAGE_OBJECTS, "<< /Author (Somchai Jaidee) /Producer (x) >>"]);
    const clean = await cleanUploadIsolated(pdf, "application/pdf");
    assert.equal(clean.length, pdf.length);
    assert.ok(!clean.toString("latin1").includes("Somchai"));
    const docx = await cleanUploadIsolated(zip(WORD_PARTS), DOCX);
    const core = readZip(docx).find((entry) => entry.name === "docProps/core.xml").read().toString("utf8");
    assert.ok(!core.includes("Somchai"));
  });

  it("passes the parser's own refusal back as the same HTTP error", async () => {
    await assert.rejects(cleanUploadIsolated(Buffer.from("%PDF-1.4\n1 0 obj << /Author (x"), "application/pdf"), (error) => error.getStatus() === 400);
  });

  it("inflates a zip entry there, refusing to grow past its declared size", async () => {
    const data = deflateRawSync(Buffer.alloc(8 * 1024 * 1024));
    await assert.rejects(runParseTask({ kind: "inflateRaw", data, maxOutputLength: 1024 }), (error) => error.getStatus() === 400);
    const ok = await runParseTask({ kind: "inflateRaw", data: deflateRawSync(Buffer.from("hello")), maxOutputLength: 5 });
    assert.equal(ok.toString(), "hello");
  });
});

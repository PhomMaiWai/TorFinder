// Unit coverage for the proposal library (#259): which of a TOR's
// qualifications a company's library covers, the starter pack's checklist
// and file plan, and the ZIP and file-type helpers behind it. Imported from
// the compiled build (run after `npm run build`, as CI does).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeFileName, sniffFileType, STORED_FILE_TYPES } from "../dist/common/stored-files.js";
import { readZip } from "../dist/common/zip.js";
import { writeZip } from "../dist/common/zip-writer.js";
import { coverageOf, groupOf } from "../dist/library/coverage.js";
import { checklistHtml, planFiles } from "../dist/library/starter-pack.js";

const TODAY = "2026-11-17";
const at = new Date("2026-01-01T00:00:00Z");
const file = (id, name = "f.pdf") => ({ id, name, contentType: "application/pdf", size: 10, uploadedAt: at });

const LIBRARY = {
  registeredCapital: 5_000_000,
  certificates: [
    { id: "c1", name: "ISO/IEC 27001:2022", standard: "iso27001", expiresAt: "2028-01-01", file: file("f1"), createdAt: at, updatedAt: at },
    { id: "c2", name: "ISO 9001", standard: "iso9001", expiresAt: "2025-01-01", createdAt: at, updatedAt: at },
  ],
  pastProjects: [
    {
      id: "p1",
      title: "ระบบบริการประชาชน สำนักงานเขต",
      clientType: "government",
      value: 4_000_000,
      completedAt: "2024-06-30",
      workTypes: ["eservice"],
      file: file("f2"),
      createdAt: at,
      updatedAt: at,
    },
    { id: "p2", title: "เว็บไซต์บริษัทเอกชน", clientType: "private", value: 9_000_000, completedAt: "2025-01-01", createdAt: at, updatedAt: at },
    { id: "p3", title: "ระบบเก่า", clientType: "government", value: 6_000_000, completedAt: "2015-01-01", createdAt: at, updatedAt: at },
  ],
  teamMembers: [
    { id: "m1", name: "สมชาย", position: "ผู้จัดการโครงการ", yearsExperience: 8, certifications: ["pmp"], file: file("f3"), createdAt: at, updatedAt: at },
    { id: "m2", name: "สมหญิง", position: "Senior Developer", yearsExperience: 4, createdAt: at, updatedAt: at },
    { id: "m3", name: "Alice", position: "โปรแกรมเมอร์", yearsExperience: 2, createdAt: at, updatedAt: at },
  ],
};

const QUALIFICATIONS = [
  "ได้รับการรับรองมาตรฐาน ISO/IEC 27001",
  "ได้รับการรับรองมาตรฐาน ISO 9001",
  "มีผลงานกับหน่วยงานของรัฐ วงเงินไม่น้อยกว่า ๓,๐๐๐,๐๐๐ บาท ภายใน 5 ปี",
  "ผู้จัดการโครงการ × 1 คน — ประสบการณ์ไม่น้อยกว่า 5 ปี และมีใบรับรอง PMP",
  "โปรแกรมเมอร์ × 2 คน — ประสบการณ์ไม่น้อยกว่า 3 ปี",
  "เป็นนิติบุคคลที่มีทุนจดทะเบียนไม่ต่ำกว่า 2 ล้านบาท",
  "คุณสมบัติทั่วไปตามระเบียบพัสดุภาครัฐ (เช่น ไม่เป็นบุคคลล้มละลาย ไม่เป็นผู้ทิ้งงาน ลงทะเบียน e-GP)",
];

describe("coverageOf", () => {
  const coverage = coverageOf(QUALIFICATIONS, LIBRARY, { torTitle: "จ้างพัฒนาระบบบริการประชาชน", today: TODAY });
  const status = coverage.items.map((item) => item.status);

  it("counts what is ready out of every line — the '4 of 7'", () => {
    assert.deepEqual(status, ["ready", "missing", "ready", "ready", "partial", "ready", "manual"]);
    assert.deepEqual(
      { total: coverage.total, ready: coverage.ready, partial: coverage.partial, missing: coverage.missing, manual: coverage.manual },
      { total: 7, ready: 4, partial: 1, missing: 1, manual: 1 },
    );
  });

  it("cites the certificate on file, and says when the only one has expired", () => {
    assert.deepEqual(coverage.items[0].evidence, [{ kind: "certificate", id: "c1", label: "ISO/IEC 27001:2022", hasFile: true }]);
    assert.match(coverage.items[1].note, /หมดอายุ/);
  });

  it("counts only government projects of the value asked, within the years asked", () => {
    assert.deepEqual(coverage.items[2].evidence.map((evidence) => evidence.id), ["p1"]);
  });

  it("matches people on role, years and certification — and counts heads", () => {
    assert.deepEqual(coverage.items[3].evidence.map((evidence) => evidence.id), ["m1"]);
    // Two developers asked with 3+ years: only one qualifies.
    assert.deepEqual(coverage.items[4].evidence.map((evidence) => evidence.id), ["m2"]);
  });

  it("keeps the line as the document printed it, Thai digits and all", () => {
    assert.equal(coverage.items[2].line, QUALIFICATIONS[2]);
  });

  it("says nothing is covered by an empty library, without guessing", () => {
    const empty = coverageOf(QUALIFICATIONS, {}, { today: TODAY });
    assert.deepEqual(
      empty.items.map((item) => item.status),
      ["missing", "missing", "missing", "missing", "missing", "manual", "manual"],
    );
  });
});

describe("groupOf", () => {
  it("reads a tester's certificate as a person's, not the company's", () => {
    assert.equal(groupOf("ผู้ทดสอบเจาะระบบต้องมีใบรับรอง OSCP"), "personnel");
    assert.equal(groupOf("บริษัทต้องได้รับการรับรอง CREST"), "certification");
  });
});

describe("starter pack", () => {
  const coverage = coverageOf(QUALIFICATIONS, LIBRARY, { torTitle: "จ้างพัฒนาระบบบริการประชาชน", today: TODAY });
  const library = { certificates: LIBRARY.certificates, pastProjects: LIBRARY.pastProjects, teamMembers: LIBRARY.teamMembers };

  it("packs only cited evidence that has a file, foldered by kind", () => {
    assert.deepEqual(
      planFiles(coverage, library).map((planned) => planned.path),
      ["1-ใบรับรอง/ISO IEC 27001 2022.pdf", "2-ผลงาน/ระบบบริการประชาชน สำนักงานเขต.pdf", "3-บุคลากร/สมชาย - CV.pdf"],
    );
  });

  it("escapes everything a company typed", () => {
    const html = checklistHtml(
      { title: "<script>alert(1)</script>", agency: "x", sourceUrl: "javascript:alert(1)" },
      coverage,
      library,
      { included: [], skipped: [], generatedAt: TODAY },
    );
    assert.ok(!html.includes("<script>alert(1)"));
    assert.ok(!html.includes('href="javascript:'));
    assert.match(html, /พร้อม <strong>4 จาก 7<\/strong>/);
  });
});

describe("writeZip", () => {
  it("writes what readZip reads back, Thai names included", () => {
    const zip = writeZip([
      { name: "00-รายการ.html", data: Buffer.from("<p>สวัสดี</p>") },
      { name: "1-ใบรับรอง/ISO.pdf", data: Buffer.from("%PDF-1.4") },
    ]);
    const entries = readZip(zip);
    assert.deepEqual(entries.map((entry) => entry.name), ["00-รายการ.html", "1-ใบรับรอง/ISO.pdf"]);
    assert.equal(entries[0].read().toString(), "<p>สวัสดี</p>");
  });
});

describe("stored files", () => {
  const docx = writeZip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "word/document.xml", data: Buffer.from("<w:document/>") },
  ]);
  const anyZip = writeZip([{ name: "evil.exe", data: Buffer.from("MZ") }]);
  const allowed = Object.values(STORED_FILE_TYPES);

  it("takes a Word document only when its parts say Word", () => {
    assert.equal(sniffFileType(docx, allowed), STORED_FILE_TYPES.docx);
    assert.equal(sniffFileType(anyZip, allowed), null);
  });

  it("refuses a type the caller doesn't allow", () => {
    assert.equal(sniffFileType(docx, [STORED_FILE_TYPES.pdf]), null);
  });

  it("names a CV after its real type", () => {
    assert.equal(safeFileName("../CV สมชาย.doc", STORED_FILE_TYPES.docx), "CV สมชาย.docx");
  });
});

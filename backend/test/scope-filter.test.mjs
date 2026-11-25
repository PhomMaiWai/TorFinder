// Unit coverage for the Bangkok-scope decision (backend/src/tor/thai-locality.ts)
// every source's import applies before TorImportService ever sees a candidate
// record — see the file's own header comment for the one rule per source.
// e-GP and gproc need none (see that comment for why), so there is nothing of
// theirs to test here; MEA composes the primitives below into meaInScope(),
// which is what its service actually calls — tested directly, so a passing
// test proves what ships, not a parallel description of it.
//
// Runs against the compiled output (`npm run build` must have run first, same
// as tor-normalize-dedup.test.mjs), the same way the rest of this suite does.
//
// Fixtures are real shapes MEA files agency/project names in: its own
// department names and the neighbouring provinces it also serves
// (backend/src/mea/mea.constants.ts).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { meaInScope, namesBangkok, namesSomewhereElse } from "../dist/tor/thai-locality.js";

describe("namesBangkok", () => {
  it("matches each of the three ways a record says Bangkok", () => {
    assert.ok(namesBangkok("กรุงเทพมหานคร"));
    assert.ok(namesBangkok("สำนักงานเขตบางรัก กทม."));
    assert.ok(namesBangkok("ระบบจองคิวออนไลน์ บางกอกน้อย"));
  });

  it("is false for an agency with no Bangkok word at all", () => {
    assert.equal(namesBangkok("การไฟฟ้านครหลวง"), false);
  });

  it("joins every argument before matching, so either field can carry it", () => {
    assert.ok(namesBangkok("ฝ่ายพัสดุ", "จัดซื้อระบบคอมพิวเตอร์ของกรุงเทพมหานคร"));
  });

  it("ignores null/undefined arguments instead of throwing", () => {
    assert.equal(namesBangkok(null, undefined, "ฝ่ายพัสดุ"), false);
  });
});

describe("namesSomewhereElse", () => {
  it("is false for an unremarkable Bangkok department", () => {
    assert.equal(namesSomewhereElse("ฝ่ายพัสดุ"), false);
  });

  it("matches a plain province name", () => {
    assert.ok(namesSomewhereElse("การไฟฟ้าส่วนภูมิภาค จังหวัดนนทบุรี"));
  });

  it("matches a local-government marker that only exists outside Bangkok", () => {
    assert.ok(namesSomewhereElse("เทศบาลนครนนทบุรี"));
    assert.ok(namesSomewhereElse("องค์การบริหารส่วนตำบลบางพลับ"));
  });

  it("requires จังหวัด in front of an ambiguous province name", () => {
    // "เลย" alone is an ordinary Thai word ("at all" / "go past"), not a hit.
    assert.equal(namesSomewhereElse("ไม่เลยกำหนดเวลา"), false);
    assert.ok(namesSomewhereElse("สำนักงานจังหวัดเลย"));
  });

  it("is false whenever the same text also names Bangkok, even next to a province word", () => {
    // MEA serving a site just across the city line, filed under a Bangkok
    // department — the override that keeps it from being wrongly dropped.
    assert.equal(namesSomewhereElse("กรุงเทพมหานคร เขตติดต่อจังหวัดนนทบุรี"), false);
  });
});

describe("meaInScope — what MeaService.isWanted actually calls", () => {
  it("keeps an announcement that names no other province", () => {
    assert.ok(meaInScope("ประกาศจัดซื้อระบบงานฝ่ายพัสดุ การไฟฟ้านครหลวง"));
  });

  it("drops an announcement MEA filed for a neighbouring province", () => {
    assert.equal(meaInScope("งานที่สำนักงานการไฟฟ้านครหลวงเขตนนทบุรี จังหวัดนนทบุรี"), false);
  });

  it("keeps it when the same text also names Bangkok", () => {
    assert.ok(meaInScope("การไฟฟ้านครหลวง เขตกรุงเทพมหานคร"));
  });
});

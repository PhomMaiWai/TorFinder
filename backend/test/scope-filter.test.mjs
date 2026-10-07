// Unit coverage for the Bangkok-scope decision (backend/src/tor/thai-locality.ts)
// every source's import applies before TorImportService ever sees a candidate
// record — see the file's own header comment for the one rule per source.
// e-GP and gproc need none (see that comment for why), so there is nothing of
// theirs to test here; MEA and data.go.th compose the primitives below into
// meaInScope() and datagovInScope(), which is what their services actually
// call — tested directly, so a passing test proves what ships, not a
// parallel description of it.
//
// Runs against the compiled output (`npm run build` must have run first, same
// as tor-normalize-dedup.test.mjs), the same way the rest of this suite does.
//
// Fixtures are real shapes the two sources file agency/project names in: MEA's
// own department names and the neighbouring provinces it also serves
// (backend/src/mea/mea.constants.ts), and data.go.th's subdep_name field,
// which is all that source keeps of where a contract was for.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BANGKOK_BOUNDS,
  datagovInScope,
  isPointInBangkok,
  meaInScope,
  namesBangkok,
  namesSomewhereElse,
} from "../dist/tor/thai-locality.js";

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

describe("isPointInBangkok", () => {
  it("accepts a point at the exact edge of the box, inclusive", () => {
    assert.ok(isPointInBangkok(BANGKOK_BOUNDS.minLat, BANGKOK_BOUNDS.minLong));
    assert.ok(isPointInBangkok(BANGKOK_BOUNDS.maxLat, BANGKOK_BOUNDS.maxLong));
  });

  it("rejects a point just outside either edge", () => {
    assert.equal(isPointInBangkok(BANGKOK_BOUNDS.minLat - 0.01, BANGKOK_BOUNDS.minLong), false);
    assert.equal(isPointInBangkok(BANGKOK_BOUNDS.maxLat, BANGKOK_BOUNDS.maxLong + 0.01), false);
  });

  it("rejects a point nowhere near Thailand", () => {
    assert.equal(isPointInBangkok(0, 0), false);
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

describe("datagovInScope — what DataGovService.isWanted actually calls", () => {
  it("keeps a record the agency name alone proves, without needing a location", () => {
    assert.ok(datagovInScope("สำนักการศึกษา กรุงเทพมหานคร", "จ้างพัฒนาระบบ", undefined));
  });

  it("falls back to the coordinates when the name is silent", () => {
    const bangkokPoint = { lat: 13.75, long: 100.5 };
    assert.ok(datagovInScope("ฝ่ายพัสดุ", "จ้างพัฒนาระบบ", bangkokPoint));
  });

  it("drops a record whose name is silent and whose coordinates are outside Bangkok", () => {
    const upcountryPoint = { lat: 18.79, long: 98.98 }; // Chiang Mai
    assert.equal(datagovInScope("ฝ่ายพัสดุ", "จ้างพัฒนาระบบ", upcountryPoint), false);
  });

  it("drops a record whose name is silent and has no location evidence at all", () => {
    assert.equal(datagovInScope("ฝ่ายพัสดุ", "จ้างพัฒนาระบบ", undefined), false);
  });
});

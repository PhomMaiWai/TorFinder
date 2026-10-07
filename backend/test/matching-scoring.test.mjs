// Unit coverage for the pure matching rules — work types, requirement parsing
// and eligibility scoring — imported from the compiled build (run after
// `npm run build`, as CI does), the same way mea-client.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreMatch } from "../dist/matching/matching.scoring.js";
import { requirementsOf } from "../dist/matching/requirements.js";
import { workTypesOf } from "../dist/matching/work-types.js";

// Thai digits, "ล้าน" and an either/or certification — the shapes real
// bidding documents use.
const QUALIFICATIONS = [
  "มีผลงานประเภทเดียวกันในวงเงินไม่น้อยกว่า ๓,๕๐๐,๐๐๐ บาท",
  "เป็นนิติบุคคลที่มีทุนจดทะเบียนไม่ต่ำกว่า 2 ล้านบาท",
  "ได้รับการรับรองมาตรฐาน ISO 9001 และ/หรือ ISO 14001",
];

const TOR = {
  title: "จ้างพัฒนาระบบบริการประชาชน",
  budgetAmount: 3_000_000,
  extraction: { qualifications: QUALIFICATIONS },
};

const QUALIFIED = {
  companyName: "Qualified Co",
  workTypes: ["development", "eservice"],
  largestPastContract: 4_000_000,
  registeredCapital: 5_000_000,
  certifications: ["iso14001"],
  preferredBudgetMin: 1_000_000,
  preferredBudgetMax: 5_000_000,
};

describe("requirementsOf", () => {
  it("reads thresholds through Thai digits and ล้าน, and keeps alternatives together", () => {
    assert.deepEqual(requirementsOf(QUALIFICATIONS), {
      minPastContract: 3_500_000,
      minRegisteredCapital: 2_000_000,
      certifications: [["iso9001", "iso14001"]],
    });
  });

  it("finds nothing in a document that states nothing checkable", () => {
    assert.deepEqual(requirementsOf(["ไม่เป็นผู้ทิ้งงาน"]), {
      minPastContract: null,
      minRegisteredCapital: null,
      certifications: [],
    });
  });
});

describe("scoreMatch — eligibility", () => {
  it("scores a company that does the work and meets every requirement at 100", () => {
    const result = scoreMatch(TOR, QUALIFIED);

    assert.equal(result.score, 100);
    assert.equal(result.eligible, true);
    assert.ok(result.eligibility.every((check) => check.status === "pass"));
  });

  it("caps a company that fails one requirement, whatever else fits", () => {
    const result = scoreMatch(TOR, { ...QUALIFIED, largestPastContract: 3_000_000 });

    assert.equal(result.score, 40);
    assert.equal(result.eligible, false);
    assert.ok(result.gaps.some((gap) => gap.includes("ไม่ผ่านเกณฑ์")));
  });

  it("leaves eligibility open when the profile doesn't say", () => {
    const result = scoreMatch(TOR, { companyName: "Blank Co", workTypes: ["development"] });

    assert.equal(result.eligible, null);
    assert.ok(result.eligibility.every((check) => check.status === "unknown"));
  });
});

describe("workTypesOf", () => {
  it("matches English terms on whole words only", () => {
    assert.ok(workTypesOf("GIS mapping platform").includes("gis"));
    assert.ok(!workTypesOf("logistics management").includes("gis"));
    assert.ok(!workTypesOf("server backups").includes("hardware"));
  });
});

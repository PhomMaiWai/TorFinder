// Unit coverage for the extraction confidence — imported from the compiled build
// (run after `npm run build`, as CI does), the same way bid-insight.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessConfidence } from "../dist/ai/extraction-confidence.js";

const FULL = {
  scope: "พัฒนาระบบบริการประชาชนออนไลน์",
  objectives: [],
  qualifications: ["มีผลงานพัฒนาระบบ"],
  deliverables: ["ระบบพร้อมใช้งาน"],
  budgetAmount: 1_000_000,
  referencePrice: 980_000,
  contractPeriod: "180 วัน",
  deadline: null,
  deadlineTime: null,
  evaluationCriteria: null,
  paymentTerms: ["งวดที่ 1: 100%"],
  bidSecurity: null,
  penalty: null,
  warrantyPeriod: null,
  contact: null,
  confidence: 0.9,
};

describe("assessConfidence", () => {
  it("rates a full extraction that matches the portal high", () => {
    const result = assessConfidence(FULL, { budgetAmount: 1_000_000, referencePrice: 980_000 });
    assert.equal(result.level, "high");
    assert.deepEqual(result.confirmed, ["budgetAmount", "referencePrice"]);
    assert.deepEqual(result.verify, []);
  });

  it("flags a budget that disagrees with the portal and lowers the score", () => {
    const matching = assessConfidence(FULL, { budgetAmount: 1_000_000 });
    const differing = assessConfidence(FULL, { budgetAmount: 1_500_000 });
    assert.deepEqual(differing.verify, ["budgetAmount"]);
    assert.ok(differing.score < matching.score);
    assert.notEqual(differing.level, "high");
  });

  it("tolerates rounding within one percent", () => {
    const result = assessConfidence(FULL, { budgetAmount: 1_005_000 });
    assert.deepEqual(result.verify, []);
  });

  it("rates a cover notice low even when the model is sure of itself", () => {
    const cover = {
      ...FULL,
      scope: "ประกาศเชิญชวน",
      qualifications: [],
      deliverables: [],
      budgetAmount: null,
      referencePrice: null,
      contractPeriod: null,
      paymentTerms: [],
      confidence: 0.95,
    };
    assert.equal(assessConfidence(cover, {}).level, "low");
  });

  it("handles extractions stored before payment terms and reference price existed", () => {
    const v1 = { ...FULL };
    delete v1.paymentTerms;
    delete v1.referencePrice;
    const result = assessConfidence(v1, { referencePrice: 500_000 });
    assert.deepEqual(result.verify, []);
    assert.ok(result.score > 0 && result.score <= 1);
  });
});

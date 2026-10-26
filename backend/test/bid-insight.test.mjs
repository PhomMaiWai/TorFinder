// Unit coverage for the bid suggestion — imported from the compiled build (run
// after `npm run build`, as CI does), the same way matching-scoring.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessBid } from "../dist/matching/bid-insight.js";

const TARGET = {
  title: "จ้างพัฒนาระบบบริการประชาชนออนไลน์",
  summary: "พัฒนาเว็บไซต์และแอปพลิเคชัน",
  tags: [],
  referencePrice: 1_000_000,
};

/** A comparable award won at `ratio` of a one-million reference price. */
function award(ratio, vendor = "บริษัท ตัวอย่าง จำกัด") {
  return {
    title: "จ้างพัฒนาระบบบริการประชาชน",
    summary: "พัฒนาเว็บไซต์และแอปพลิเคชัน",
    tags: [],
    referencePrice: 1_000_000,
    contracts: [{ vendor, amount: 1_000_000 * ratio }],
  };
}

describe("assessBid", () => {
  it("says nothing without a price to set a bid against", () => {
    const insight = assessBid({ ...TARGET, referencePrice: undefined }, [award(0.9)]);
    assert.equal(insight.status, "insufficient");
    assert.equal(insight.base, null);
  });

  it("holds back on too few awards", () => {
    const insight = assessBid(TARGET, [award(0.9), award(0.95)]);
    assert.equal(insight.status, "insufficient");
    assert.equal(insight.pricePoints.length, 0);
  });

  it("calls a market won near the reference price a blue ocean", () => {
    const insight = assessBid(TARGET, [0.97, 0.98, 0.99, 0.96, 0.98].map((r) => award(r)));
    assert.equal(insight.status, "ok");
    assert.equal(insight.competition, "blue");
    assert.equal(insight.pricePoints.find((p) => p.label === "recommended").price, 980_000);
  });

  it("calls a market won by deep cuts a red ocean, and the cheaper bid the likelier win", () => {
    const peers = [0.7, 0.75, 0.8, 0.72, 0.78, 0.74].map((r, i) => award(r, i < 4 ? "บริษัท ก จำกัด" : "บริษัท ข จำกัด"));
    const insight = assessBid(TARGET, peers);
    assert.equal(insight.competition, "red");
    const [aggressive, recommended, conservative] = insight.pricePoints;
    assert.ok(aggressive.price < recommended.price && recommended.price < conservative.price);
    assert.ok(aggressive.winChance > conservative.winChance);
    assert.deepEqual(insight.topWinners[0], { vendor: "บริษัท ก จำกัด", wins: 4 });
    assert.equal(insight.distinctWinners, 2);
  });

  it("drops awards whose figure cannot be a price for the whole project", () => {
    const insight = assessBid(TARGET, [0.9, 0.9, 0.9, 0.9, 0.9, 0.05, 3].map((r) => award(r)));
    assert.equal(insight.peerCount, 5);
  });
});

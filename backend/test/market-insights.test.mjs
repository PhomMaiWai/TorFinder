// Unit coverage for the market insights (FR-24, #256) — imported from the
// compiled build (run after `npm run build`, as CI does), like bid-insight.test.mjs.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMarketInsights, vendorKey } from "../dist/insights/market-insights.js";

let serial = 0;
/** One awarded project at `agency`, won by `vendor` at `ratio` of a one-million reference price. */
function award(agency, vendor, ratio = 0.9, extra = {}) {
  serial += 1;
  return {
    agency,
    projectNumber: `P-${serial}`,
    referencePrice: 1_000_000,
    contracts: vendor ? [{ vendor, amount: 1_000_000 * ratio, signedAt: new Date("2025-03-01T00:00:00Z") }] : [],
    ...extra,
  };
}

const find = (insights, agency) => insights.agencies.find((row) => row.agency === agency);

describe("vendorKey", () => {
  it("folds the legal-form words and spacing agencies type a company name with", () => {
    const key = vendorKey("บริษัท เอบีซี ซอฟต์ จำกัด");
    assert.equal(vendorKey("บจก.เอบีซี ซอฟต์"), key);
    assert.equal(vendorKey("เอบีซีซอฟต์ จำกัด"), key);
    assert.equal(vendorKey("ABC Soft Co., Ltd."), vendorKey("abc soft"));
  });

  it("keeps genuinely different names apart", () => {
    assert.notEqual(vendorKey("บริษัท เอบีซี จำกัด"), vendorKey("บริษัท เอบีดี จำกัด"));
  });
});

describe("buildMarketInsights — winners per agency", () => {
  it("ranks winners and gives each its share of the agency's awards", () => {
    const records = [
      award("เขตก", "บริษัท หนึ่ง จำกัด"),
      award("เขตก", "บริษัท หนึ่ง จำกัด"),
      award("เขตก", "บจก. หนึ่ง"),
      award("เขตก", "บริษัท สอง จำกัด"),
    ];
    const row = find(buildMarketInsights(records), "เขตก");
    assert.equal(row.projects, 4);
    assert.equal(row.distinctWinners, 2);
    assert.equal(row.topWinners[0].wins, 3);
    assert.equal(row.topWinners[0].share, 0.75);
    assert.equal(row.competition, "low", "one company won three of four");
  });

  it("calls an agency whose awards all go to different companies contested", () => {
    const records = ["ก", "ข", "ค", "ง"].map((name) => award("เขตข", `บริษัท ${name} จำกัด`));
    assert.equal(find(buildMarketInsights(records), "เขตข").competition, "high");
  });

  it("does not judge competition on too few named winners", () => {
    const records = [award("เขตค", "บริษัท ก จำกัด"), award("เขตค", "บริษัท ก จำกัด")];
    assert.equal(find(buildMarketInsights(records), "เขตค").competition, null);
  });

  it("totals a company's wins across agencies", () => {
    const records = [award("เขตก", "บริษัท ก จำกัด"), award("เขตข", "บริษัท ก จำกัด"), award("เขตข", "บริษัท ข จำกัด")];
    const [top] = buildMarketInsights(records).topWinners;
    assert.deepEqual(top, { vendor: "บริษัท ก จำกัด", wins: 2, totalAwarded: 1_800_000, agencies: 2 });
  });
});

describe("buildMarketInsights — awarded against the reference price", () => {
  it("reports the median and mean discount, and a price-competition reading", () => {
    const records = [0.7, 0.75, 0.8].map((ratio) => award("เขตง", "บริษัท ก จำกัด", ratio));
    const insights = buildMarketInsights(records);
    const row = find(insights, "เขตง");
    assert.ok(Math.abs(row.medianDiscount - 0.25) < 1e-9);
    assert.ok(Math.abs(row.averageDiscount - 0.25) < 1e-9);
    assert.equal(row.priceCompetition, "red");
    assert.equal(insights.summary.referenceBased, 3);
    assert.equal(insights.discountBands.find((b) => b.band === "25%+").projects, 2);
  });

  it("falls back to the budget where no reference price was published, and says so", () => {
    const records = [award("เขตจ", "บริษัท ก จำกัด", 0.9, { referencePrice: undefined, budgetAmount: 1_000_000 })];
    const { summary } = buildMarketInsights(records);
    assert.equal(summary.budgetBased, 1);
    assert.equal(summary.referenceBased, 0);
  });

  it("leaves out an award that cannot be a price for the whole project", () => {
    const records = [award("เขตฉ", "บริษัท ก จำกัด", 0.05), award("เขตฉ", "บริษัท ก จำกัด", 3)];
    const insights = buildMarketInsights(records);
    assert.equal(insights.summary.priced, 0);
    assert.equal(find(insights, "เขตฉ").projects, 2, "the wins still count");
  });

  it("holds back an agency's discount below three priced awards", () => {
    const row = find(buildMarketInsights([award("เขตช", "บริษัท ก จำกัด")]), "เขตช");
    assert.equal(row.medianDiscount, null);
    assert.equal(row.priceCompetition, null);
  });
});

describe("buildMarketInsights — one project, many records", () => {
  it("counts a project once and takes the price and winner from whichever stage has them", () => {
    const records = [
      { agency: "เขตซ", projectNumber: "SAME", referencePrice: 1_000_000 },
      { agency: "เขตซ", projectNumber: "SAME", contracts: [{ vendor: "บริษัท ก จำกัด", amount: 900_000 }] },
      { agency: "เขตซ", projectNumber: "SAME", contracts: [{ vendor: "บริษัท ก จำกัด", amount: 900_000 }] },
    ];
    const insights = buildMarketInsights(records);
    assert.equal(insights.summary.projects, 1);
    assert.equal(insights.summary.priced, 1);
    assert.equal(find(insights, "เขตซ").topWinners[0].wins, 1);
  });

  it("ignores records with neither a winner nor an award amount", () => {
    const insights = buildMarketInsights([{ agency: "เขตฌ", projectNumber: "X", budgetAmount: 1_000_000 }]);
    assert.equal(insights.summary.projects, 0);
  });
});

describe("buildMarketInsights — by year", () => {
  it("lists the years with awards and filters to one", () => {
    const records = [
      award("เขตญ", "บริษัท ก จำกัด", 0.9, { contracts: [{ vendor: "บริษัท ก จำกัด", amount: 900_000, signedAt: new Date("2024-06-01T00:00:00Z") }] }),
      award("เขตญ", "บริษัท ข จำกัด"),
    ];
    const all = buildMarketInsights(records);
    assert.deepEqual(all.years, [2025, 2024]);
    const only2024 = buildMarketInsights(records, 2024);
    assert.equal(only2024.summary.projects, 1);
    assert.equal(only2024.topWinners[0].vendor, "บริษัท ก จำกัด");
  });
});

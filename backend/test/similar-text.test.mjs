// Unit coverage for find-similar's text handling — imported from the compiled
// build (run after `npm run build`, as CI does). No database, no model.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denseCosine,
  displayScore,
  keywordScores,
  tokenize,
  torText,
} from "../dist/similar/similar-text.js";

describe("tokenize", () => {
  it("splits Thai into words and drops boilerplate, numbers and function words", () => {
    const tokens = tokenize("จ้างพัฒนาระบบการเรียนการสอนออนไลน์ ปี 2567 จำนวน 1 ระบบ");
    assert.ok(tokens.includes("พัฒนา"));
    assert.ok(tokens.includes("เรียน"));
    assert.ok(tokens.includes("ออนไลน์"));
    for (const dropped of ["จ้าง", "การ", "2567", "1", "ปี", "จำนวน"]) {
      assert.ok(!tokens.includes(dropped), `${dropped} should be dropped`);
    }
  });

  it("lower-cases English terms", () => {
    assert.ok(tokenize("CCTV System").includes("cctv"));
  });
});

describe("torText", () => {
  it("reads the title, extracted scope, summary and tags, and leaves the agency out", () => {
    const text = torText({
      title: "ระบบ e-Learning",
      agency: "สำนักการศึกษา",
      summary: "สรุป",
      tags: ["การศึกษา"],
      extraction: { scope: "ขอบเขตงาน", objectives: ["วัตถุประสงค์"] },
    });
    for (const part of ["ระบบ e-Learning", "ขอบเขตงาน", "วัตถุประสงค์", "สรุป", "การศึกษา"]) {
      assert.ok(text.includes(part), part);
    }
    assert.ok(!text.includes("สำนักการศึกษา"));
  });

  it("works on a record with nothing but a title", () => {
    assert.equal(torText({ title: "ระบบ" }), "ระบบ");
  });
});

describe("keywordScores", () => {
  const candidates = [
    "ระบบอีเลิร์นนิง บทเรียนออนไลน์ สำหรับโรงเรียน",
    "บำรุงรักษากล้องวงจรปิด CCTV",
    "บทเรียนออนไลน์ แบบทดสอบ",
  ];

  it("scores the candidates that share rare words above the ones that don't", () => {
    const scores = keywordScores("บทเรียนออนไลน์ให้โรงเรียน", candidates);
    assert.equal(scores.length, candidates.length);
    assert.ok(scores[0].score > scores[1].score);
    assert.ok(scores[2].score > scores[1].score);
    assert.equal(scores[1].score, 0);
    assert.deepEqual(scores[1].shared, []);
  });

  it("names the shared words, the heaviest first", () => {
    const [first] = keywordScores("บทเรียนออนไลน์ให้โรงเรียน", candidates);
    assert.ok(first.shared.includes("บทเรียน"));
    assert.ok(first.shared.length <= 5);
  });

  it("gives an identical text the top score", () => {
    const scores = keywordScores(candidates[1], candidates);
    assert.ok(Math.abs(scores[1].score - 1) < 1e-9);
  });

  it("handles an empty corpus and an empty query", () => {
    assert.deepEqual(keywordScores("ระบบ", []), []);
    assert.equal(keywordScores("", candidates)[0].score, 0);
  });
});

describe("denseCosine", () => {
  it("is 1 for the same direction, 0 for orthogonal and for mismatched or empty vectors", () => {
    assert.ok(Math.abs(denseCosine([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
    assert.equal(denseCosine([1, 0], [0, 1]), 0);
    assert.equal(denseCosine([1, 0], [1, 0, 0]), 0);
    assert.equal(denseCosine([], []), 0);
    assert.equal(denseCosine([0, 0], [1, 1]), 0);
  });
});

describe("displayScore", () => {
  it("shows an embedding cosine as it is and spreads a keyword cosine out", () => {
    assert.equal(displayScore(0.82, "ai"), 82);
    assert.equal(displayScore(0.25, "keyword"), 50);
    assert.equal(displayScore(-0.1, "ai"), 0);
    assert.equal(displayScore(1.2, "keyword"), 100);
  });
});

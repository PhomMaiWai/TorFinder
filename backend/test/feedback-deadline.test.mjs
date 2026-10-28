// Unit coverage for the feedback deadline (#140): how a model's answer is
// cleaned into one, and the Bangkok calendar day a portal's date becomes.
// Imported from the compiled build (run after `npm run build`, as CI does),
// the same way extraction-confidence.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseExtraction } from "../dist/ai/tor-extraction.js";
import { bangkokDay } from "../dist/tor/tor-normalize.js";

const answer = (feedbackDeadline) => ({ scope: "ระบบทดสอบ", confidence: 0.9, feedbackDeadline });

describe("parseExtraction — feedbackDeadline", () => {
  it("keeps an ISO date the model read", () => {
    assert.equal(parseExtraction(answer("2026-11-05")).feedbackDeadline, "2026-11-05");
  });

  it("drops a Buddhist year the model forgot to convert", () => {
    assert.equal(parseExtraction(answer("2569-11-05")).feedbackDeadline, null);
  });

  it("is null when the answer isn't a date, or has none", () => {
    assert.equal(parseExtraction(answer("ภายใน 7 วัน")).feedbackDeadline, null);
    assert.equal(parseExtraction(answer(null)).feedbackDeadline, null);
    assert.equal(parseExtraction({ scope: "ระบบทดสอบ", confidence: 0.9 }).feedbackDeadline, null);
  });

  it("is a field of its own, not a copy of the bid deadline", () => {
    const parsed = parseExtraction({ ...answer("2026-11-05"), deadline: "2026-12-01" });
    assert.equal(parsed.feedbackDeadline, "2026-11-05");
    assert.equal(parsed.deadline, "2026-12-01");
  });
});

describe("bangkokDay", () => {
  it("is the calendar day in Bangkok, not in UTC", () => {
    // 20:00 UTC on 28 Oct is 03:00 on 29 Oct in Bangkok.
    assert.equal(bangkokDay(new Date("2026-10-28T20:00:00Z")), "2026-10-29");
    assert.equal(bangkokDay(new Date("2026-10-28T10:00:00Z")), "2026-10-28");
  });

  it("is undefined for no date", () => {
    assert.equal(bangkokDay(null), undefined);
  });
});

// Unit coverage for feedbackWindow() in src/lib/tor-ui.ts — the "is this TOR
// currently open for public comment, and until when" flag (FR-18, issue
// #216). Like the deadline filter it sits next to, this is a pure function
// that lives entirely in a client component (the TOR detail page and search
// cards both call it directly), so there is no server-rendered HTML an e2e
// test could assert on; this tests the logic directly instead.
//
// What's NOT covered here, because it's tested elsewhere: the backend's
// resolution of the feedbackDeadline field itself (portal-stated vs.
// AI-extracted — backend/test/feedback-deadline*.test.mjs) and the backend's
// own deadline enforcement on POST /tor/:id/feedback
// (backend/test/feedback-window.e2e.test.mjs). This file is only the
// frontend's open/until flag that #215 built on top of those fields.
//
// Runs on Node's native TypeScript support (no ts-node/tsx needed) — see
// package.json's test:e2e script, same as tor-deadline-filter.test.mts.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedbackWindow } from "../src/lib/tor-ui.ts";
import type { Bidding, TorStage } from "../src/types/tor.ts";

const DAY_MS = 86_400_000;
const DRAFT_STAGE: TorStage = "เปิดรับฟังความคิดเห็น";

/** Today's date in Bangkok, formed the same way feedbackWindow()'s own bangkokToday() does. */
function bangkokDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

type Fields = {
  deadline: string;
  daysLeft: number;
  stage: TorStage;
  bidding: Bidding;
  feedbackDeadline?: string;
};

const UNKNOWN_BIDDING: Bidding = { status: "unknown", reason: null, opensAt: null, closesAt: null, closesAtSource: null };

function draft(overrides: Partial<Fields> = {}): Fields {
  return {
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    stage: DRAFT_STAGE,
    bidding: UNKNOWN_BIDDING,
    ...overrides,
  };
}

describe("feedbackWindow — a comment deadline on the draft stage", () => {
  it("is open through the whole of the deadline day", () => {
    const result = feedbackWindow(draft({ feedbackDeadline: bangkokDate(0) }));
    assert.deepEqual(result, { open: true, until: bangkokDate(0) });
  });

  it("is still open the day before the deadline", () => {
    const result = feedbackWindow(draft({ feedbackDeadline: bangkokDate(1) }));
    assert.equal(result.open, true);
  });

  it("closes the day after the deadline", () => {
    const result = feedbackWindow(draft({ feedbackDeadline: bangkokDate(-1) }));
    assert.deepEqual(result, { open: false, until: bangkokDate(-1) });
  });
});

describe("feedbackWindow — no comment deadline on the draft stage falls back to bidding", () => {
  it("is open when the draft's own bidding status is open", () => {
    const result = feedbackWindow(
      draft({ bidding: { status: "open", reason: null, opensAt: null, closesAt: "2026-12-31", closesAtSource: "portal" } }),
    );
    assert.deepEqual(result, { open: true, until: "2026-12-31" });
  });

  it("is closed when the draft's own bidding status is closed", () => {
    const result = feedbackWindow(
      draft({ bidding: { status: "closed", reason: "deadline", opensAt: null, closesAt: null, closesAtSource: "portal" } }),
    );
    assert.deepEqual(result, { open: false, until: null });
  });

  it("defaults open when the bidding status is unknown — only an explicit 'closed' shuts it off", () => {
    const result = feedbackWindow(draft({ bidding: UNKNOWN_BIDDING }));
    assert.deepEqual(result, { open: true, until: null });
  });
});

describe("feedbackWindow — once the stage has moved past the comment period", () => {
  it("is closed even if a comment deadline is still in the future", () => {
    const result = feedbackWindow(
      draft({ stage: "ประกาศ TOR", feedbackDeadline: bangkokDate(30) }),
    );
    assert.deepEqual(result, { open: false, until: bangkokDate(30) }, "the stage gate overrides a future deadline");
  });

  it("is closed with no until date when there was never a comment deadline", () => {
    const result = feedbackWindow(draft({ stage: "ประกาศผู้ชนะ" }));
    assert.deepEqual(result, { open: false, until: null });
  });

  it("ignores the bidding fallback once the stage has moved on", () => {
    const result = feedbackWindow(
      draft({
        stage: "ประกาศ TOR",
        bidding: { status: "open", reason: null, opensAt: null, closesAt: "2026-12-31", closesAtSource: "portal" },
      }),
    );
    assert.deepEqual(result, { open: false, until: null }, "bidding.closesAt must not leak into 'until' past the draft stage");
  });
});

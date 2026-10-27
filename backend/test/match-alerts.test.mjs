// Unit coverage for which match alerts a company gets — imported from the
// compiled build (run after `npm run build`, as CI does), like bid-insight.test.mjs.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { alertText, phaseOf, planAlerts, projectKeyOf, sentKey } from "../dist/matching/match-alerts.js";

const STAGE = {
  plan: "แผนการจัดซื้อจัดจ้าง",
  draft: "เปิดรับฟังความคิดเห็น",
  price: "ประกาศราคากลาง",
  invitation: "ประกาศ TOR",
  award: "ประกาศผู้ชนะ",
};

function tor(stage, projectNumber) {
  return { _id: new ObjectId(), stage, projectNumber, title: "จ้างพัฒนาระบบ", agency: "สำนักงานเขต", budget: "฿1,000,000" };
}

const NONE = new Set();
const defaults = { threshold: 70, max: 5, sent: NONE };

describe("phaseOf", () => {
  it("puts plan, draft and reference price early, the invitation on its own, and the award nowhere", () => {
    assert.equal(phaseOf(STAGE.plan), "early");
    assert.equal(phaseOf(STAGE.draft), "early");
    assert.equal(phaseOf(STAGE.price), "early");
    assert.equal(phaseOf(STAGE.invitation), "invitation");
    assert.equal(phaseOf(STAGE.award), null);
  });
});

describe("projectKeyOf", () => {
  it("keys by project number, so every stage of a project is one project", () => {
    assert.equal(projectKeyOf(tor(STAGE.draft, "69099314442")), projectKeyOf(tor(STAGE.invitation, "69099314442")));
  });

  it("keys a record without a project number by itself", () => {
    const record = tor(STAGE.draft);
    assert.equal(projectKeyOf(record), `tor:${record._id.toString()}`);
  });
});

describe("planAlerts", () => {
  it("keeps what clears the company's threshold, best first", () => {
    const [low, mid, high] = [tor(STAGE.invitation, "1"), tor(STAGE.invitation, "2"), tor(STAGE.invitation, "3")];
    const plan = planAlerts(
      [
        { tor: low, score: 69 },
        { tor: mid, score: 75 },
        { tor: high, score: 92 },
      ],
      defaults,
    );
    assert.deepEqual(plan.map((alert) => alert.score), [92, 75]);
  });

  it("honours a stricter threshold", () => {
    const plan = planAlerts([{ tor: tor(STAGE.invitation, "1"), score: 85 }], { ...defaults, threshold: 90 });
    assert.equal(plan.length, 0);
  });

  it("drops a project the company is ruled out of, however high it scores", () => {
    const plan = planAlerts([{ tor: tor(STAGE.invitation, "1"), score: 95, eligible: false }], defaults);
    assert.equal(plan.length, 0);
  });

  it("skips awarded records", () => {
    assert.equal(planAlerts([{ tor: tor(STAGE.award, "1"), score: 95 }], defaults).length, 0);
  });

  it("sends each project once per phase", () => {
    const record = tor(STAGE.draft, "1");
    const sent = new Set([sentKey(projectKeyOf(record), "early")]);
    assert.equal(planAlerts([{ tor: record, score: 90 }], { ...defaults, sent }).length, 0);
  });

  it("alerts again when the invitation opens, and says the company heard earlier", () => {
    const invitation = tor(STAGE.invitation, "1");
    const sent = new Set([sentKey(projectKeyOf(invitation), "early")]);
    const [alert] = planAlerts([{ tor: invitation, score: 90 }], { ...defaults, sent });
    assert.equal(alert.phase, "invitation");
    assert.equal(alert.followsEarly, true);
  });

  it("alerts a project once when two of its stages arrive together, at the later one", () => {
    const plan = planAlerts(
      [
        { tor: tor(STAGE.draft, "1"), score: 80 },
        { tor: tor(STAGE.invitation, "1"), score: 80 },
      ],
      defaults,
    );
    assert.equal(plan.length, 1);
    assert.equal(plan[0].phase, "invitation");
  });

  it("caps a batch at max per company", () => {
    const scored = Array.from({ length: 8 }, (_, i) => ({ tor: tor(STAGE.invitation, String(i)), score: 80 + i }));
    const plan = planAlerts(scored, { ...defaults, max: 3 });
    assert.deepEqual(plan.map((alert) => alert.score), [87, 86, 85]);
  });
});

describe("alertText", () => {
  const base = { tor: tor(STAGE.draft, "1"), score: 82 };

  it("names the stage and the head start for an early alert", () => {
    const { title, message } = alertText({ ...base, phase: "early", followsEarly: false });
    assert.match(title, /82%/);
    assert.match(title, new RegExp(STAGE.draft));
    assert.match(message, /มีเวลาเตรียมตัว/);
  });

  it("says bids are open when following up an early alert", () => {
    assert.match(alertText({ ...base, phase: "invitation", followsEarly: true }).title, /เปิดรับข้อเสนอแล้ว/);
  });

  it("is a plain new-TOR alert when the invitation is the first the company hears", () => {
    assert.match(alertText({ ...base, phase: "invitation", followsEarly: false }).title, /^TOR ใหม่ตรงกับบริษัทคุณ 82%/);
  });
});

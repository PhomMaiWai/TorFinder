// The stage model (backend/src/tor/tor.constants.ts), without a server. Loaded
// from dist like the other logic-only suites — run `npm run build` first.
//
// Stage values are stored on every record, so what each name means is not up
// to the code: the literals below are the ones already in the database, written
// as code points so no editor or tool can normalise them into different text.
// And code reads stages by name — never by position in TOR_STAGES — so the list
// can grow without anything silently changing meaning.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EGP_ANNOUNCE_TYPES } from "../dist/egp/egp.constants.js";
import { GPROC_ANNOUNCE_TYPES } from "../dist/gproc/gproc.constants.js";
import { STAGE, STAGE_LISTING_ORDER, TOR_STAGES } from "../dist/tor/tor.constants.js";
import { buildTimeline, stageOfAnnouncement } from "../dist/tor/tor-stage.js";

const DRAFT = "เปิดรับฟังความคิดเห็น";
const INVITATION = "ประกาศ TOR";
const PLAN = "\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e08\u0e31\u0e14\u0e0b\u0e37\u0e49\u0e2d\u0e08\u0e31\u0e14\u0e08\u0e49\u0e32\u0e07";
const PRICE = "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e23\u0e32\u0e04\u0e32\u0e01\u0e25\u0e32\u0e07";
const AWARD = "ประกาศผู้ชนะ";

describe("stored stage values", () => {
  it("draft, invitation and award keep the text already on every record", () => {
    assert.equal(STAGE.draft, DRAFT);
    assert.equal(STAGE.invitation, INVITATION);
    assert.equal(STAGE.award, AWARD);
  });

  it("plan and price are the labels process5 already uses for those notices", () => {
    assert.equal(STAGE.plan, PLAN);
    assert.equal(STAGE.price, PRICE);
    assert.equal(GPROC_ANNOUNCE_TYPES.P0.label, PLAN);
    assert.equal(GPROC_ANNOUNCE_TYPES.price.label, PRICE);
  });
});

describe("the stage lists", () => {
  it("TOR_STAGES is the lifecycle: plan, draft, price, invitation, award", () => {
    assert.deepEqual([...TOR_STAGES], [STAGE.plan, STAGE.draft, STAGE.price, STAGE.invitation, STAGE.award]);
  });

  it("every named stage is in TOR_STAGES, and nothing else is", () => {
    assert.deepEqual([...TOR_STAGES].sort(), Object.values(STAGE).sort());
  });

  it("the listing order is a permutation of TOR_STAGES — no stage left out, none twice", () => {
    assert.deepEqual([...STAGE_LISTING_ORDER].sort(), [...TOR_STAGES].sort());
    assert.equal(new Set(STAGE_LISTING_ORDER).size, STAGE_LISTING_ORDER.length);
  });

  it("lists what a company can act on before what is already decided", () => {
    assert.equal(STAGE_LISTING_ORDER.at(-1), STAGE.award);
    assert.ok(STAGE_LISTING_ORDER.indexOf(STAGE.invitation) < STAGE_LISTING_ORDER.indexOf(STAGE.plan));
  });
});

describe("announcement types still map to the same stages", () => {
  const egp = Object.fromEntries(EGP_ANNOUNCE_TYPES.map((type) => [type.code, type.stage]));

  it("e-GP: 98 is the draft, D0 the invitation, W0 the award", () => {
    assert.equal(egp["98"], STAGE.draft);
    assert.equal(egp.D0, STAGE.invitation);
    assert.equal(egp.W0, STAGE.award);
  });

  it("process5: B0 is the draft, D0 the invitation, W0 the award", () => {
    assert.equal(GPROC_ANNOUNCE_TYPES.B0.stage, STAGE.draft);
    assert.equal(GPROC_ANNOUNCE_TYPES.D0.stage, STAGE.invitation);
    assert.equal(GPROC_ANNOUNCE_TYPES.W0.stage, STAGE.award);
  });
});

describe("stageOfAnnouncement", () => {
  it("reads the stage from the announcement's title", () => {
    assert.equal(stageOfAnnouncement("แผนการจัดซื้อจัดจ้าง"), STAGE.plan);
    assert.equal(stageOfAnnouncement("ประกาศราคากลาง"), STAGE.price);
    assert.equal(stageOfAnnouncement("ร่างขอบเขตของงาน (TOR)"), STAGE.draft);
    assert.equal(stageOfAnnouncement("ประกาศเชิญชวน"), STAGE.invitation);
    assert.equal(stageOfAnnouncement("ประกาศรายชื่อผู้ชนะการเสนอราคา"), STAGE.award);
    assert.equal(stageOfAnnouncement("ประกาศรายชื่อผู้ได้รับการคัดเลือก"), STAGE.award);
  });

  it("a draft invitation is a draft, not an invitation", () => {
    assert.equal(stageOfAnnouncement("ร่างประกาศเชิญชวน"), STAGE.draft);
  });

  it("a withdrawal and an unknown title belong to no stage", () => {
    assert.equal(stageOfAnnouncement("ยกเลิกประกาศเชิญชวน"), null);
    assert.equal(stageOfAnnouncement("ตารางแสดงวงเงิน"), null);
  });
});

describe("buildTimeline", () => {
  const reached = (timeline) => timeline.filter((entry) => entry.reached).map((entry) => entry.stage);

  it("always lists the five stages in lifecycle order", () => {
    const timeline = buildTimeline({ stage: STAGE.draft });
    assert.deepEqual(timeline.map((entry) => entry.stage), [...TOR_STAGES]);
  });

  it("marks exactly one stage current — the record's own", () => {
    const timeline = buildTimeline({ stage: STAGE.invitation, documents: [] });
    assert.deepEqual(timeline.filter((entry) => entry.current).map((entry) => entry.stage), [STAGE.invitation]);
  });

  it("with no paper trail only the record's own stage is reached", () => {
    assert.deepEqual(reached(buildTimeline({ stage: STAGE.draft })), [STAGE.draft]);
  });

  it("derives plan and price from the document list", () => {
    const timeline = buildTimeline({
      stage: STAGE.invitation,
      documents: [
        { label: "ประกาศเชิญชวน", publishedAt: new Date("2026-03-10T00:00:00Z") },
        { label: "ประกาศราคากลาง", publishedAt: new Date("2026-03-09T00:00:00Z") },
        { label: "แผนการจัดซื้อจัดจ้าง", publishedAt: new Date("2026-01-05T00:00:00Z") },
      ],
    });
    assert.deepEqual(reached(timeline), [STAGE.plan, STAGE.price, STAGE.invitation]);
    assert.equal(timeline[0].publishedAt, "2026-01-05T00:00:00.000Z");
  });

  it("does not infer a stage nothing shows: an award with no plan has no plan", () => {
    const timeline = buildTimeline({
      stage: STAGE.award,
      documents: [{ label: "ประกาศรายชื่อผู้ชนะการเสนอราคา", publishedAt: null }],
    });
    assert.deepEqual(reached(timeline), [STAGE.award]);
    assert.equal(timeline.at(-1).publishedAt, null);
  });

  it("a reference price on file means the price stage happened", () => {
    assert.ok(reached(buildTimeline({ stage: STAGE.invitation, referencePrice: 500000 })).includes(STAGE.price));
  });

  it("a withdrawal does not make the invitation reached", () => {
    const timeline = buildTimeline({
      stage: STAGE.draft,
      documents: [{ label: "ยกเลิกประกาศเชิญชวน", publishedAt: new Date("2026-02-01T00:00:00Z") }],
    });
    assert.deepEqual(reached(timeline), [STAGE.draft]);
  });

  it("takes the earliest date when a stage has several announcements", () => {
    const timeline = buildTimeline({
      stage: STAGE.invitation,
      documents: [
        { label: "ประกาศเชิญชวน", publishedAt: new Date("2026-03-20T00:00:00Z") },
        { label: "ประกาศเชิญชวน (แก้ไข)", publishedAt: new Date("2026-03-10T00:00:00Z") },
      ],
    });
    assert.equal(timeline.find((entry) => entry.stage === STAGE.invitation).publishedAt, "2026-03-10T00:00:00.000Z");
  });
});

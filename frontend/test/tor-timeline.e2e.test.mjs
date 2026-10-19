// End-to-end coverage proving the TOR detail page actually renders the stage
// timeline the backend computes (backend/src/tor/tor-stage.ts, buildTimeline),
// rather than only being verified at the API layer — see
// backend/test/tor-stages.test.mjs for buildTimeline's own logic, and
// backend/test/tor.e2e.test.mjs for currentStage/timeline on the API response.
//
// Node's built-in runner + fetch, same as admin-dashboard.e2e.test.mjs, against
// a *running production build* of this app (`next build && next start`), since
// TorDetailPage is a server component — there is no rendered HTML to assert on
// from source alone. The record is inserted straight into the `tors`
// collection, the same way that suite inserts a syncRuns row, since there is no
// public way to import a real e-GP announcement from a test.
//
// Requires, all pointed at the same database:
//   - E2E_BACKEND_URL   a running backend (default http://localhost:4000)
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - MONGODB_URI       the database both of the above are using

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";

/** Renders a TOR detail page in English, for stable heading assertions. */
async function renderPage(path) {
  const res = await fetch(`${FRONTEND_URL}${path}`, { headers: { cookie: "NEXT_LOCALE=en" } });
  assert.equal(res.status, 200, `${path} should render, got ${res.status}`);
  return res.text();
}

/**
 * Whether `stage` appears as a timeline entry styled the way TorTimeline marks
 * `status` — current (accent), reached-but-not-current (ink), or unreached
 * (ink-subtle). Matches either the mobile or desktop block: they share the
 * label classes down to the text size, which this ignores.
 */
function hasStageStyledAs(html, stage, status) {
  // The literal `">` right after the color class is what tells "text-ink"
  // apart from "text-ink-subtle" — both start the same, but only the exact
  // match is immediately followed by the closing quote.
  const color = { current: "text-accent", reached: "text-ink", unreached: "text-ink-subtle" }[status];
  const pattern = new RegExp(`font-semibold leading-snug ${color}">${stage}<`);
  return pattern.test(html);
}

let mongo;
let insertedId;

before(async () => {
  mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();

  // A paper trail that skips the plan and the reference price on purpose —
  // reached must come from evidence, not from "earlier than the current
  // stage" — with an invitation as the current stage, so the timeline has all
  // three visual states (reached, current, unreached) to render at once.
  const { insertedId: id } = await mongo.db().collection("tors").insertOne({
    title: "E2E: timeline rendering",
    agency: "E2E Test Agency",
    budget: "1,000,000 บาท",
    deadline: "2026-11-15",
    daysLeft: 10,
    match: 0,
    tags: [],
    stage: "ประกาศ TOR",
    summary: "Seeded by tor-timeline.e2e.test.mjs",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    sourceRef: `egp:e2e-timeline-${Date.now()}:D0`,
    documents: [
      { label: "ร่างขอบเขตของงาน (TOR)", publishedAt: "2026-08-15T00:00:00Z", url: "https://example.com/draft.pdf" },
      { label: "ประกาศเชิญชวน", publishedAt: "2026-09-01T00:00:00Z", url: "https://example.com/invite.pdf" },
    ],
  });
  insertedId = id;
});

after(async () => {
  if (insertedId) await mongo?.db().collection("tors").deleteOne({ _id: new ObjectId(insertedId) });
  await mongo?.close();
});

describe("TOR detail page — stage timeline", () => {
  it("shows the timeline heading and all five stages in lifecycle order", async () => {
    const html = await renderPage(`/tor/${insertedId}`);

    const headingAt = html.indexOf("Project timeline");
    assert.ok(headingAt >= 0, "the section heading should render");

    // The header badge above the timeline also prints tor.stage ("ประกาศ
    // TOR"), so the order check starts searching only from the heading on —
    // otherwise that earlier mention would read as an out-of-order stage.
    const order = ["แผนการจัดซื้อจัดจ้าง", "เปิดรับฟังความคิดเห็น", "ประกาศราคากลาง", "ประกาศ TOR", "ประกาศผู้ชนะ"];
    const positions = [];
    for (const stage of order) {
      positions.push(html.indexOf(stage, positions.at(-1) ?? headingAt));
    }
    assert.ok(
      positions.every((p) => p >= 0),
      "every stage name should appear after the timeline heading",
    );
    assert.ok(
      positions.every((p, i) => i === 0 || p > positions[i - 1]),
      "stages should read in lifecycle order: plan, draft, price, invitation, award",
    );
  });

  it("marks the draft and invitation reached, with the dates their documents carry", async () => {
    const html = await renderPage(`/tor/${insertedId}`);

    assert.ok(hasStageStyledAs(html, "เปิดรับฟังความคิดเห็น", "reached"), "the draft stage should read as reached");
    assert.ok(html.includes("15 ส.ค. 2569"), "the draft's date should be the document's publishedAt");
    assert.ok(html.includes("1 ก.ย. 2569"), "the invitation's date should be the document's publishedAt");
  });

  it("marks the invitation as the current stage", async () => {
    const html = await renderPage(`/tor/${insertedId}`);
    assert.ok(hasStageStyledAs(html, "ประกาศ TOR", "current"), "the record's own stage should read as current");
  });

  it("leaves the plan and reference price unreached — no document names either one", async () => {
    const html = await renderPage(`/tor/${insertedId}`);

    assert.ok(hasStageStyledAs(html, "แผนการจัดซื้อจัดจ้าง", "unreached"), "no plan document was ever published");
    assert.ok(hasStageStyledAs(html, "ประกาศราคากลาง", "unreached"), "no reference price document was ever published");
  });

  it("leaves the award unreached — the project hasn't gotten there yet", async () => {
    const html = await renderPage(`/tor/${insertedId}`);
    assert.ok(hasStageStyledAs(html, "ประกาศผู้ชนะ", "unreached"));
  });
});

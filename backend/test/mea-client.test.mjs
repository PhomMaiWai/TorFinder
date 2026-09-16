// Unit coverage for the MEA scraper (backend/src/mea/mea.client.ts): the
// DataTables pagination in announcements() and the regex HTML parsing in
// detail(). Unlike the other portal clients (data.go.th, e-GP), MEA publishes
// no API — every fact comes out of hand-written regexes over the site's own
// HTML, which is exactly the kind of logic that breaks silently, so it is
// worth pinning down with fixtures instead of only exercising it live.
//
// Runs against the compiled output (`npm run build` must have run first, same
// as the e2e suite's "Build" step in .github/workflows/auth.yml) because
// MeaClient carries a NestJS decorator, which Node's native TS support cannot
// strip — importing the .ts source directly throws a syntax error. Global
// fetch is stubbed per test instead of hitting the real portal.

import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";

import { MeaClient } from "../dist/mea/mea.client.js";
import { MEA_ANNOUNCE_TYPES, MEA_ENDPOINTS, MEA_REQUEST } from "../dist/mea/mea.constants.js";

const PROCUREMENT = MEA_ANNOUNCE_TYPES.find((t) => t.path === "Procurement");
const DRAFT = MEA_ANNOUNCE_TYPES.find((t) => t.path === "Draft");

const originalFetch = globalThis.fetch;

/** Queues one Response-returning function per expected fetch call, in order. */
function stubFetch(responses) {
  const calls = [];
  let next = 0;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const make = responses[next++];
    if (!make) throw new Error(`unexpected fetch call #${next}: ${url}`);
    return make();
  };
  return calls;
}

function jsonResponse(body) {
  return () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function htmlResponse(html) {
  return () => new Response(html, { status: 200, headers: { "content-type": "text/html" } });
}

after(() => {
  globalThis.fetch = originalFetch;
});

describe("MeaClient#announcements — DataTables pagination (Procurement, WinningBidder)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("pages until recordsTotal is reached, concatenating every page", async () => {
    const calls = stubFetch([
      jsonResponse({ recordsTotal: 5, recordsFiltered: 5, data: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
      jsonResponse({ recordsTotal: 5, recordsFiltered: 5, data: [{ id: 4 }, { id: 5 }] }),
    ]);

    const rows = await new MeaClient().announcements(PROCUREMENT);

    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    assert.equal(calls.length, 2, "3 rows of 5 should force a second page");
    assert.equal(calls[0].url.pathname, "/Procurement/Search");
    assert.equal(new URLSearchParams(calls[0].init.body).get("start"), "0");
    // The loop advances by the fixed page size, not by how many rows the
    // first (mocked) page actually returned.
    assert.equal(new URLSearchParams(calls[1].init.body).get("start"), String(MEA_REQUEST.pageSize));
  });

  it("stops on an empty page even short of recordsTotal", async () => {
    stubFetch([
      jsonResponse({ recordsTotal: 5, recordsFiltered: 5, data: [{ id: 1 }] }),
      jsonResponse({ recordsTotal: 5, recordsFiltered: 5, data: [] }),
    ]);

    const rows = await new MeaClient().announcements(PROCUREMENT);

    assert.deepEqual(rows, [{ id: 1 }], "a listing that shrank mid-sync must not loop on its empty tail");
  });

  it("returns a single page outright when it already covers recordsTotal", async () => {
    const calls = stubFetch([jsonResponse({ recordsTotal: 2, recordsFiltered: 2, data: [{ id: 1 }, { id: 2 }] })]);

    const rows = await new MeaClient().announcements(PROCUREMENT);

    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }]);
    assert.equal(calls.length, 1);
  });
});

describe("MeaClient#announcements — bare-array shape (Draft)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the whole table from one request, untouched", async () => {
    const calls = stubFetch([jsonResponse([{ id: "d1" }, { id: "d2" }])]);

    const rows = await new MeaClient().announcements(DRAFT);

    assert.deepEqual(rows, [{ id: "d1" }, { id: "d2" }]);
    assert.equal(calls.length, 1, "an array response is already the whole table — no page 2 request");
    assert.equal(calls[0].url.pathname, "/Draft/Search");
  });
});

describe("MeaClient#detail — regex HTML parsing", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("prefers the agreed price over the offered price when both are published", async () => {
    stubFetch([
      htmlResponse(`
        <table>
          <tr><th scope="row">วงเงินงบประมาณ</th><td>2,144,669.48&nbsp;บาท</td></tr>
          <tr><th scope="row">ราคารวมที่เสนอ</th><td>2,100,000.00 บาท</td></tr>
          <tr><th scope="row">ราคารวมที่ตกลง</th><td>2,090,000.00 บาท</td></tr>
          <tr><th scope="row">หน่วยงานที่่จัดซื้อจัดจ้าง</th><td>ฝ่ายพัสดุ</td></tr>
        </table>
      `),
    ]);

    const detail = await new MeaClient().detail(PROCUREMENT, "123");

    assert.equal(detail.budgetAmount, 2_144_669.48);
    assert.equal(detail.awardedAmount, 2_090_000, "the agreed figure should win over the offered one");
    assert.equal(detail.department, "ฝ่ายพัสดุ", "a label with the site's own typo should still match by prefix");
  });

  it("falls back to the offered price when no agreed price is published", async () => {
    stubFetch([
      htmlResponse(`
        <table>
          <tr><th scope="row">ราคารวมที่เสนอ</th><td>500,000 บาท</td></tr>
        </table>
      `),
    ]);

    const detail = await new MeaClient().detail(PROCUREMENT, "124");

    assert.equal(detail.awardedAmount, 500_000);
  });

  it("treats a zero or unparsable amount as absent, not zero", async () => {
    stubFetch([
      htmlResponse(`
        <table>
          <tr><th scope="row">วงเงินงบประมาณ</th><td>0.00 บาท</td></tr>
        </table>
      `),
    ]);

    const detail = await new MeaClient().detail(PROCUREMENT, "125");

    assert.equal(detail.budgetAmount, undefined);
  });

  it("dedupes a link repeated for view and download, and derives a fallback label from the filename", async () => {
    stubFetch([
      htmlResponse(`
        <table>
          <tr>
            <td>
              เอกสารประกาศ.pdf [ขนาดไฟล์ 1.2 MB]
              <a href="/files_procurement/abc123.pdf">ดูเอกสาร</a>
              <a href="/files_procurement/abc123.pdf">ดาวน์โหลด</a>
            </td>
          </tr>
          <tr>
            <td><a href="/files_procurement/xyz%20file.pdf">ดาวน์โหลด</a></td>
          </tr>
        </table>
      `),
    ]);

    const detail = await new MeaClient().detail(PROCUREMENT, "126");

    assert.equal(detail.documents.length, 2, "the two identical hrefs in one cell must collapse to one document");
    assert.equal(detail.documents[0].label, "เอกสารประกาศ.pdf");
    assert.equal(detail.documents[0].url, "/files_procurement/abc123.pdf");
    assert.equal(
      detail.documents[1].label,
      "xyz file.pdf",
      "with no printed label, the filename off the URL should be used instead",
    );
  });
});

describe("MeaClient#detailUrl / #types", () => {
  it("builds the public detail page URL", () => {
    const url = new MeaClient().detailUrl(PROCUREMENT, "999");
    assert.equal(url, `${MEA_ENDPOINTS.site}/Procurement/Detail/999`);
  });

  it("exposes exactly the three announcement types the sync reads", () => {
    const paths = new MeaClient().types.map((t) => t.path);
    assert.deepEqual(paths, ["Draft", "Procurement", "WinningBidder"]);
  });
});

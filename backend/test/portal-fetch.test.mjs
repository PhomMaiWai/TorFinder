// Unit coverage for the portal file allowlist (ASVS 1.3.6, 13.2.4, 15.3.2;
// threat E3): which URLs the server may fetch an announcement's file from,
// and that a redirect can't take it anywhere else. fetch is stubbed, so
// nothing leaves the machine. Loaded from dist — run `npm run build` first.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { fetchPortalFile, isAllowedPortalUrl } from "../dist/common/portal-fetch.js";
import { isArchiveDocument, isReadableDocument, isViewableDocument, READABLE_DOCUMENT_PATTERN } from "../dist/tor/tor-documents.js";

const EGP = "https://egp2.bangkok.go.th/api/file/b79a494e/0010_draft.pdf";
const MEA = "https://procurement.mea.or.th/files_procurement/WORK_PRICE/cbecb5cf/kas.pdf";

describe("isAllowedPortalUrl", () => {
  it("accepts the two portal file hosts over HTTPS", () => {
    assert.ok(isAllowedPortalUrl(EGP));
    assert.ok(isAllowedPortalUrl(MEA));
    assert.ok(isAllowedPortalUrl("https://EGP2.Bangkok.go.th/api/file/x.pdf"));
  });

  for (const [why, url] of [
    ["plain HTTP", "http://egp2.bangkok.go.th/api/file/x.pdf"],
    ["another host", "https://evil.example/api/file/x.pdf"],
    ["a look-alike host", "https://egp2.bangkok.go.th.evil.example/api/file/x.pdf"],
    ["a subdomain", "https://x.egp2.bangkok.go.th/api/file/x.pdf"],
    ["an explicit port", "https://egp2.bangkok.go.th:8443/api/file/x.pdf"],
    ["credentials", "https://user:pw@egp2.bangkok.go.th/api/file/x.pdf"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["localhost", "https://localhost/api/file/x.pdf"],
    ["not a URL", "egp2.bangkok.go.th/api/file/x.pdf"],
  ]) {
    it(`refuses ${why}`, () => assert.equal(isAllowedPortalUrl(url), false));
  }
});

describe("document checks follow the allowlist", () => {
  it("treats a portal file elsewhere as a plain link, never a fetchable document", () => {
    const elsewhere = "https://evil.example/api/file/x.pdf";
    assert.equal(isViewableDocument(elsewhere), false);
    assert.equal(isReadableDocument(elsewhere), false);
    assert.equal(isArchiveDocument("https://evil.example/files_procurement/x.zip"), false);
    assert.ok(isViewableDocument(EGP));
    assert.ok(isReadableDocument(MEA));
  });

  it("the Mongo pattern selects exactly what isReadableDocument accepts", () => {
    const pattern = new RegExp(READABLE_DOCUMENT_PATTERN, "i");
    for (const url of [EGP, MEA, "https://evil.example/api/file/x.pdf", "http://egp2.bangkok.go.th/api/file/x.pdf", "https://egp2.bangkok.go.th/api/file/x.zip"]) {
      assert.equal(pattern.test(url), isReadableDocument(url), url);
    }
  });
});

describe("fetchPortalFile", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** fetch answering each URL from a table; records what was asked for. */
  function stub(responses) {
    const asked = [];
    globalThis.fetch = async (url, init) => {
      asked.push({ url: String(url), redirect: init?.redirect });
      const answer = responses[String(url)];
      if (!answer) throw new Error(`unexpected fetch ${url}`);
      return new Response(answer.body ?? null, { status: answer.status, headers: answer.headers });
    };
    return asked;
  }

  it("never fetches a URL off the allowlist", async () => {
    const asked = stub({});
    await assert.rejects(fetchPortalFile("http://169.254.169.254/latest/meta-data/"), { status: 404 });
    assert.equal(asked.length, 0);
  });

  it("follows a redirect within the allowlist, by hand", async () => {
    const asked = stub({
      [EGP]: { status: 302, headers: { location: "/api/file/moved.pdf" } },
      "https://egp2.bangkok.go.th/api/file/moved.pdf": { status: 200, body: "%PDF", headers: { "content-type": "application/pdf" } },
    });
    const res = await fetchPortalFile(EGP);
    assert.equal(res.status, 200);
    assert.deepEqual(asked.map((a) => a.redirect), ["manual", "manual"]);
  });

  it("refuses a redirect to an internal or foreign address", async () => {
    const asked = stub({ [EGP]: { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } } });
    await assert.rejects(fetchPortalFile(EGP), { status: 404 });
    assert.equal(asked.length, 1);
  });

  it("gives up on a redirect loop", async () => {
    stub({ [EGP]: { status: 301, headers: { location: EGP } } });
    await assert.rejects(fetchPortalFile(EGP), { status: 502 });
  });
});

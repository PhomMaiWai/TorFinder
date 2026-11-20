// Unit coverage for ASVS 3.7.3: links out of TorFinder go through the /leaving
// notice (src/lib/external-link.ts), and that page only ever offers a real
// web address, so it can't be turned into a javascript: or data: link.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { leavingHref, leavingTarget } from "../src/lib/external-link.ts";

describe("leavingHref", () => {
  it("sends absolute web links through /leaving", () => {
    const url = "https://process3.gprocurement.go.th/egp2procmainWeb/jsp/procsearch.sch?a=1&b=2";
    assert.equal(leavingHref(url), `/leaving?to=${encodeURIComponent(url)}`);
    assert.equal(leavingHref("HTTP://line.me/R/ti/p/@x"), `/leaving?to=${encodeURIComponent("HTTP://line.me/R/ti/p/@x")}`);
  });

  it("leaves our own pages and files as they are", () => {
    for (const href of ["/tor/0123456789abcdef01234567", "/api/tor/x/document", "#top", undefined, ""]) {
      assert.equal(leavingHref(href), href);
    }
  });
});

describe("leavingTarget", () => {
  it("accepts http and https only", () => {
    assert.equal(leavingTarget("https://www.mea.or.th/x")?.hostname, "www.mea.or.th");
    assert.equal(leavingTarget("http://example.com")?.protocol, "http:");
  });

  it("refuses anything that isn't a web address", () => {
    for (const to of ["javascript:alert(1)", "data:text/html,<b>x</b>", "/relative", "//evil.example", "not a url", "", undefined]) {
      assert.equal(leavingTarget(to), null, String(to));
    }
  });
});

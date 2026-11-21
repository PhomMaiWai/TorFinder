// Unit coverage for the cross-site write check (src/lib/request-origin.ts,
// docs/SECURITY.md G5).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCrossSiteWrite } from "../src/lib/request-origin.ts";

const headers = (values: Record<string, string>) => new Headers(values);

describe("isCrossSiteWrite", () => {
  it("lets reads through whatever their origin", () => {
    assert.equal(isCrossSiteWrite("GET", "/api/saved-searches", headers({ "sec-fetch-site": "cross-site" })), false);
  });

  it("refuses a POST another site started (Sec-Fetch-Site)", () => {
    assert.equal(isCrossSiteWrite("POST", "/api/saved-searches", headers({ "sec-fetch-site": "cross-site" })), true);
    assert.equal(isCrossSiteWrite("DELETE", "/api/saved-searches/1", headers({ "sec-fetch-site": "same-site" })), true);
  });

  it("allows this site's own pages and typed-in requests", () => {
    assert.equal(isCrossSiteWrite("POST", "/api/saved-searches", headers({ "sec-fetch-site": "same-origin" })), false);
    assert.equal(isCrossSiteWrite("POST", "/api/saved-searches", headers({ "sec-fetch-site": "none" })), false);
  });

  it("falls back to Origin against the requested host when Sec-Fetch-Site is missing", () => {
    assert.equal(isCrossSiteWrite("POST", "/api/x", headers({ origin: "https://evil.example", host: "torfinder.example" })), true);
    assert.equal(isCrossSiteWrite("POST", "/api/x", headers({ origin: "https://torfinder.example", host: "torfinder.example" })), false);
    assert.equal(
      isCrossSiteWrite("PUT", "/api/x", headers({ origin: "https://torfinder.example", host: "frontend:3000", "x-forwarded-host": "torfinder.example" })),
      false,
      "behind a reverse proxy the forwarded host counts",
    );
    assert.equal(isCrossSiteWrite("POST", "/api/x", headers({ origin: "null", host: "torfinder.example" })), true);
  });

  it("leaves non-browser clients and server-to-server routes to their own checks", () => {
    assert.equal(isCrossSiteWrite("POST", "/api/x", headers({ host: "torfinder.example" })), false);
    assert.equal(isCrossSiteWrite("POST", "/api/line/webhook", headers({ "sec-fetch-site": "cross-site" })), false);
  });
});

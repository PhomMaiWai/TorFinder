// Unit coverage for the production HTTP -> HTTPS redirect (src/lib/https-redirect.ts,
// docs/SECURITY.md G9).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { httpsRedirectTarget } from "../src/lib/https-redirect.ts";

const url = new URL("http://frontend:3000/search?q=erp");

describe("httpsRedirectTarget", () => {
  it("sends a production request that came in over HTTP to the same path on HTTPS", () => {
    const target = httpsRedirectTarget(url, new Headers({ "x-forwarded-proto": "http", "x-forwarded-host": "torfinder.example" }), true);
    assert.equal(target?.toString(), "https://torfinder.example/search?q=erp");
  });

  it("leaves HTTPS, local hosts and development alone", () => {
    assert.equal(httpsRedirectTarget(url, new Headers({ "x-forwarded-proto": "https", host: "torfinder.example" }), true), null);
    assert.equal(httpsRedirectTarget(url, new Headers({ "x-forwarded-proto": "http", host: "localhost:3000" }), true), null);
    assert.equal(httpsRedirectTarget(url, new Headers({ "x-forwarded-proto": "http", host: "torfinder.example" }), false), null);
    assert.equal(httpsRedirectTarget(url, new Headers({ host: "torfinder.example" }), true), null);
  });
});

// Unit coverage for the sign-in `?next=` check (src/lib/safe-redirect.ts,
// ASVS 3.7.2): same-site paths go through, anything a browser could read as
// another host falls back.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeNextPath } from "../src/lib/safe-redirect.ts";

describe("safeNextPath", () => {
  it("keeps same-site paths, query and all", () => {
    assert.equal(safeNextPath("/saved", "/"), "/saved");
    assert.equal(safeNextPath("/tor/abc?tab=docs#files", "/"), "/tor/abc?tab=docs#files");
    // Percent-encoded text is just characters in a same-site path.
    assert.equal(safeNextPath("/%0a", "/"), "/%0a");
  });

  it("falls back for anything that could leave the site", () => {
    for (const next of [
      null,
      "",
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "/\tevil",
      "/ok\u0000",
    ]) {
      assert.equal(safeNextPath(next, "/home"), "/home", JSON.stringify(next));
    }
  });
});

// Unit coverage for ASVS 13.4.7: outside /api/, a path that looks like a file
// is refused before routing (src/lib/served-files.ts); pages are not.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isUnexpectedFile } from "../src/lib/served-files.ts";

describe("isUnexpectedFile", () => {
  it("refuses file-looking paths the site doesn't serve", () => {
    for (const path of ["/.env", "/.git/config", "/backup.zip", "/index.php", "/admin/config.json", "/wp-login.php", "/tor/x.bak"]) {
      assert.equal(isUnexpectedFile(path), true, path);
    }
  });

  it("lets pages and API routes through", () => {
    for (const path of ["/", "/search", "/tor/0123456789abcdef01234567", "/admin/users", "/leaving", "/api/certificates/abc/file", "/api/tor/x.y/document"]) {
      assert.equal(isUnexpectedFile(path), false, path);
    }
  });
});

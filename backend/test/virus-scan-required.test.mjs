// docs/SECURITY.md G6: with VIRUS_SCAN_REQUIRED on (the production default)
// and no ClamAV configured, a file is refused rather than stored unscanned.
// Its own file because env.ts reads the settings once, at import.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

let scanForViruses;

before(async () => {
  delete process.env.CLAMAV_HOST;
  process.env.VIRUS_SCAN_REQUIRED = "true";
  ({ scanForViruses } = await import("../dist/common/virus-scan.js"));
});

describe("virus scan required (G6)", () => {
  it("refuses a file with 503 when no scanner is configured", async () => {
    await assert.rejects(
      () => scanForViruses(Buffer.from("%PDF-1.4 test"), { source: "test", userId: "u1" }),
      (error) => error.getStatus() === 503,
    );
  });
});

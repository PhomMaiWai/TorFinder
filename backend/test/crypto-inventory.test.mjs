// ASVS 11.1.3: cryptographic discovery is part of the build. The scan in
// scripts/crypto-inventory.mjs finds every cryptographic API the backend and
// frontend use; this test fails when the code uses cryptography in a file,
// or through an API, that docs/security/crypto-inventory.json doesn't record,
// so a new use can't arrive without the inventory (and its review) changing.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { discover } from "../../scripts/crypto-inventory.mjs";

const recorded = JSON.parse(readFileSync(new URL("../../docs/security/crypto-inventory.json", import.meta.url), "utf8"));

describe("cryptographic inventory (ASVS 11.1.3)", () => {
  const found = discover();

  it("finds cryptography in the source at all (the scan works)", () => {
    assert.ok(Object.keys(found).length > 10);
    assert.deepEqual(found["backend/src/common/token.ts"], ["createHmac", "timingSafeEqual"]);
  });

  it("every cryptographic use in the code is in the recorded inventory", () => {
    const unrecorded = Object.entries(found).flatMap(([file, apis]) =>
      apis.filter((api) => !(recorded[file] ?? []).includes(api)).map((api) => `${file}: ${api}`),
    );
    assert.deepEqual(unrecorded, [], "run `node scripts/crypto-inventory.mjs --json > docs/security/crypto-inventory.json` and add the use to crypto-inventory.md");
  });

  it("the recorded inventory lists nothing the code no longer uses", () => {
    const stale = Object.entries(recorded).flatMap(([file, apis]) =>
      apis.filter((api) => !(found[file] ?? []).includes(api)).map((api) => `${file}: ${api}`),
    );
    assert.deepEqual(stale, []);
  });
});

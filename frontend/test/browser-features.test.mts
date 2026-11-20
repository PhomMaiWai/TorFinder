// ASVS 3.7.5: the checks behind the "your browser is missing security
// features" warning (src/lib/browser-features.ts). A current browser on HTTPS
// passes all of them; an old browser, or a page not served securely, doesn't.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { missingSecurityFeatures } from "../src/lib/browser-features.ts";

const modern = () => ({
  SecurityPolicyViolationEvent: class {},
  crypto: { subtle: {} },
  crossOriginIsolated: false,
}) as unknown as typeof globalThis;

describe("missingSecurityFeatures (ASVS 3.7.5)", () => {
  it("finds nothing missing in a current browser over HTTPS", () => {
    assert.deepEqual(missingSecurityFeatures(modern()), []);
  });

  it("names each missing feature", () => {
    const old = modern() as unknown as Record<string, unknown>;
    delete old.SecurityPolicyViolationEvent;
    delete old.crossOriginIsolated;
    assert.deepEqual(missingSecurityFeatures(old as unknown as typeof globalThis), ["csp", "cross-origin-isolation"]);
  });

  it("treats a page without Web Crypto (not a secure context) as missing protection", () => {
    const insecure = { ...modern(), crypto: {} } as unknown as typeof globalThis;
    assert.deepEqual(missingSecurityFeatures(insecure), ["secure-context"]);
  });
});

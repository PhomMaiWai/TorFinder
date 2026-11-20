// ASVS 1.3.12: no regular expression in the backend or frontend can be made
// to backtrack exponentially (or polynomially) by its input. The audit in
// scripts/regex-audit.mjs finds every regex with the TypeScript parser, checks
// its shape and times it against adversarial inputs with a hard stop; this
// test fails CI on any finding. It also checks that the audit would catch the
// classic bad patterns, so a passing run means something.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { audit, hasNestedQuantifier, slowestMatchMs } from "../../scripts/regex-audit.mjs";

describe("ReDoS audit (ASVS 1.3.12)", () => {
  it("catches the classic catastrophic patterns", () => {
    for (const source of ["(a+)+$", "(\\w*)*x", "(a|a)*b"]) assert.ok(hasNestedQuantifier(source), source);
    assert.equal(slowestMatchMs({ source: "^\\s*\\s*\\s*$", flags: "" }), Infinity, "a polynomial one is caught by timing");
    assert.ok(slowestMatchMs({ source: "^[a-z]+$", flags: "" }) < 50);
  });

  it("finds the application's regexes and none of them is ReDoS-prone", () => {
    const { count, findings } = audit();
    assert.ok(count > 100, `expected to find the app's regexes, found ${count}`);
    assert.deepEqual(findings.map((f) => `${f.file}:${f.line} /${f.source}/ — ${f.problem}`), []);
  });
});

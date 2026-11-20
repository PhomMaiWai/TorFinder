// Unit coverage for ASVS 3.4.3, 3.4.6 and 3.4.7: the nonce policy the proxy
// sets on every page (src/lib/csp.ts) and the fallback policy next.config.ts
// sends on every other response. A change that weakens either fails here
// instead of waiting for the next ZAP scan.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import nextConfig from "../next.config.ts";
import { newCspNonce, pageContentSecurityPolicy } from "../src/lib/csp.ts";

/** "a b; c d" → Map { a => ["b"], c => ["d"] } */
function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (!name) continue;
    assert.equal(map.has(name), false, `directive ${name} appears twice`);
    map.set(name, sources);
  }
  return map;
}

/** What every policy we send must hold, page or fallback. */
function assertBaseline(policy: Map<string, string[]>) {
  assert.deepEqual(policy.get("default-src"), ["'self'"]);
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  assert.deepEqual(policy.get("base-uri"), ["'none'"]);
  assert.deepEqual(policy.get("form-action"), ["'self'"]);
  assert.deepEqual(policy.get("frame-ancestors"), ["'self'"]);
  assert.deepEqual(policy.get("report-uri"), ["/api/csp-report"]);
  assert.deepEqual(policy.get("report-to"), ["csp"]);

  const scripts = policy.get("script-src") ?? [];
  assert.ok(scripts.length > 0, "script-src is set");
  assert.ok(!scripts.includes("'unsafe-inline'"), "no inline scripts");
  for (const [name, sources] of policy) {
    for (const source of sources) {
      assert.ok(!/^\*$|^https?:$|^https?:\/\/\*/.test(source), `${name} has wildcard source ${source}`);
    }
  }
}

describe("page CSP (proxy)", () => {
  const nonce = newCspNonce();

  it("holds the baseline", () => {
    assertBaseline(directives(pageContentSecurityPolicy(nonce, false)));
  });

  it("runs only scripts carrying this response's nonce", () => {
    const scripts = directives(pageContentSecurityPolicy(nonce, false)).get("script-src");
    assert.ok(scripts?.includes(`'nonce-${nonce}'`));
    assert.ok(scripts?.includes("'strict-dynamic'"));
    assert.ok(!scripts?.includes("'unsafe-eval'"), "no eval in production");
  });

  it("allows eval and the dev-server socket only in development", () => {
    const dev = directives(pageContentSecurityPolicy(nonce, true));
    assert.ok(dev.get("script-src")?.includes("'unsafe-eval'"));
    assert.ok(dev.get("connect-src")?.includes("ws:"));
    const prod = directives(pageContentSecurityPolicy(nonce, false));
    assert.ok(!prod.get("connect-src")?.includes("ws:"));
  });

  it("lets in no origin besides Google sign-in", () => {
    for (const [name, sources] of directives(pageContentSecurityPolicy(nonce, false))) {
      for (const source of sources.filter((s) => s.startsWith("http"))) {
        assert.ok(source.startsWith("https://accounts.google.com/gsi/"), `${name} allows ${source}`);
      }
    }
  });

  it("makes a fresh, unguessable nonce each time", () => {
    const nonces = new Set(Array.from({ length: 1000 }, newCspNonce));
    assert.equal(nonces.size, 1000);
    for (const n of nonces) {
      assert.match(n, /^[A-Za-z0-9+/]+=*$/);
      assert.ok(atob(n).length >= 32, "at least a full UUID of input");
    }
  });
});

describe("fallback headers (next.config.ts)", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const all = rules.find((rule) => rule.source === "/:path*")?.headers ?? [];
  const header = (key: string) => all.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

  it("applies to every path", () => {
    assert.ok(all.length > 0);
  });

  it("sends a strict CSP with no nonce and no outside origin", () => {
    const csp = header("Content-Security-Policy");
    assert.ok(csp, "CSP is set");
    const policy = directives(csp);
    assertBaseline(policy);
    assert.deepEqual(policy.get("script-src"), ["'self'"]);
    assert.ok(!csp.includes("http"), "no outside origin");
  });

  it("names the endpoint that report-to points at", () => {
    assert.equal(header("Reporting-Endpoints"), 'csp="/api/csp-report"');
  });
});

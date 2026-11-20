// Unit coverage for building backend paths from browser-chosen values
// (src/lib/backend-path.ts; threat model T5, ASVS 1.3.6). `encodeURIComponent`
// alone leaves `..` as it is and `fetch` resolves it, so these are the checks
// that keep a request on the backend route it was meant for.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { idPath, isBackendPathTooLong, isObjectId, isPlainPath, MAX_BACKEND_PATH } from "../src/lib/backend-path.ts";

const ID = "0123456789abcdef01234567";

describe("idPath", () => {
  it("passes a real ObjectId", () => {
    assert.equal(idPath(ID), ID);
    assert.equal(isObjectId(ID.toUpperCase()), true);
  });

  it("refuses anything else", () => {
    for (const id of ["..", ".", "", "x/../../accounts", `${ID}/..`, "%2e%2e", ID.slice(1), undefined, 42]) {
      assert.throws(() => idPath(id), /Invalid record id/, String(id));
    }
  });
});

describe("isPlainPath", () => {
  it("accepts ordinary backend paths", () => {
    for (const path of ["/certificates", `/certificates/${ID}/file`, `/library/projects/${ID}`, "/notifications/channels/line/link"]) {
      assert.equal(isPlainPath(path), true, path);
    }
  });

  it("refuses dot segments, encoded or not, and hidden separators", () => {
    for (const path of [
      "/certificates/../file",
      "/certificates/./file",
      "/certificates/%2e%2e/file",
      "/certificates/%2E%2E",
      "/library/projects/a%2Fb/file",
      "/library/projects/a%5Cb",
      "/library/%E0%A4%A",
    ]) {
      assert.equal(isPlainPath(path), false, path);
    }
  });

  it("would otherwise have walked to another route", () => {
    // The bug this guards against: what fetch makes of an unchecked `..`.
    assert.equal(new URL(`http://backend/api/certificates/${encodeURIComponent("..")}/file`).pathname, "/api/file");
  });
});

describe("isBackendPathTooLong (ASVS 4.2.5)", () => {
  it("lets every ordinary backend path through", () => {
    assert.equal(isBackendPathTooLong(`/api/tor/${ID}/documents/0?download=1`), false);
    assert.equal(isBackendPathTooLong(`/api/audit?page=2&actor=admin%40bma.go.th&action=x&from=2026-11-01&to=2026-11-20`), false);
  });

  it("refuses a path past the limit the backend is sure to accept", () => {
    assert.equal(isBackendPathTooLong("/api/audit?actor=" + "a".repeat(MAX_BACKEND_PATH)), true);
    assert.equal(isBackendPathTooLong("/" + "a".repeat(MAX_BACKEND_PATH - 1)), false);
    assert.equal(isBackendPathTooLong("/" + "a".repeat(MAX_BACKEND_PATH)), true);
  });

  it("stays well under Node's 16 KB header limit", () => {
    assert.ok(MAX_BACKEND_PATH <= 4096);
  });
});

// Unit coverage for linking a LINE account (backend/src/notifications/line-link.ts),
// imported from the compiled build (run after `npm run build`, as CI does).

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

process.env.LINE_BOT_ID = "@123abcde";
const { hashLinkCode, lineLinkUrls, newLinkCode, parseLinkCode, verifyLineSignature } = await import(
  "../dist/notifications/line-link.js"
);

describe("LINE link codes", () => {
  it("are TF- plus eight characters that can't be misread", () => {
    for (let i = 0; i < 200; i++) assert.match(newLinkCode(), /^TF-[A-HJKMNP-Z2-9]{8}$/);
  });

  it("are read back however the user typed them", () => {
    const code = newLinkCode();
    assert.equal(parseLinkCode(code), code);
    assert.equal(parseLinkCode(code.toLowerCase()), code);
    assert.equal(parseLinkCode(code.slice(3)), code);
    assert.equal(parseLinkCode(`  ${code.slice(3, 7)} ${code.slice(7)}\n`), code);
  });

  it("are not found inside ordinary chat", () => {
    assert.equal(parseLinkCode("สวัสดีครับ"), null);
    assert.equal(parseLinkCode("please link TF-ABCDEFGH"), null);
    assert.equal(parseLinkCode("ABCDEFGHJ"), null);
    assert.equal(parseLinkCode("TF-ABCDEFG1"), null);
  });

  it("are stored only as a hash", () => {
    assert.match(hashLinkCode("TF-ABCDEFGH"), /^[0-9a-f]{64}$/);
    assert.notEqual(hashLinkCode("TF-ABCDEFGH"), hashLinkCode("TF-ABCDEFGJ"));
  });

  it("open the OA chat with the code typed in", () => {
    const { addFriendUrl, messageUrl } = lineLinkUrls("TF-ABCDEFGH");
    assert.equal(addFriendUrl, "https://line.me/R/ti/p/%40123abcde");
    assert.equal(messageUrl, "https://line.me/R/oaMessage/%40123abcde/?TF-ABCDEFGH");
  });
});

describe("LINE webhook signature", () => {
  const body = Buffer.from('{"events":[]}');
  const sign = (secret, bytes = body) => createHmac("sha256", secret).update(bytes).digest("base64");

  it("accepts the body LINE signed with our secret", () => {
    assert.equal(verifyLineSignature(body, sign("s3cret"), "s3cret"), true);
  });

  it("refuses another secret, a changed body, or no signature", () => {
    assert.equal(verifyLineSignature(body, sign("other"), "s3cret"), false);
    assert.equal(verifyLineSignature(Buffer.from('{"events":[1]}'), sign("s3cret"), "s3cret"), false);
    assert.equal(verifyLineSignature(body, undefined, "s3cret"), false);
    assert.equal(verifyLineSignature(body, "short", "s3cret"), false);
  });

  it("refuses everything while no secret is configured", () => {
    assert.equal(verifyLineSignature(body, sign(""), ""), false);
  });
});

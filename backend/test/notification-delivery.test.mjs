// Unit coverage for sending notifications to Email, Slack and LINE — imported
// from the compiled build (run after `npm run build`, as CI does). `fetch` is
// replaced, so nothing leaves the machine.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

process.env.RESEND_API_KEY = "re_test";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "line_test";
const { activeChannels, deliver } = await import("../dist/notifications/notification-delivery.js");

const SLACK = "https://hooks.slack.com/services/T000/B000/XXXX";
const LINE = `U${"a".repeat(32)}`;
const NOTE = { title: "TOR ใหม่", message: "จ้างพัฒนาระบบ", link: "https://example.com/tor/1" };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Records every request and answers each with `status`. */
function stubFetch(status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return new Response("ok", { status });
  };
  return calls;
}

describe("notification delivery", () => {
  it("sends nothing for an account that turned nothing on", async () => {
    const calls = stubFetch();
    assert.deepEqual(activeChannels(undefined), []);
    assert.deepEqual(await deliver({ email: "a@example.com" }, NOTE), []);
    assert.equal(calls.length, 0);
  });

  it("sends to every channel the account turned on", async () => {
    const calls = stubFetch();
    const results = await deliver(
      { email: "a@example.com", notificationChannels: { email: true, slackWebhookUrl: SLACK, lineUserId: LINE } },
      NOTE,
    );

    assert.deepEqual(results.map((r) => [r.channel, r.ok]), [["email", true], ["slack", true], ["line", true]]);
    const email = calls.find((c) => c.url.includes("resend"));
    assert.deepEqual(email.body.to, ["a@example.com"]);
    assert.equal(email.headers.Authorization, "Bearer re_test");
    assert.ok(calls.find((c) => c.url === SLACK).body.text.includes(NOTE.link));
    assert.equal(calls.find((c) => c.url.includes("line.me")).body.to, LINE);
  });

  it("reports a failed channel instead of throwing", async () => {
    stubFetch(500);
    const [result] = await deliver({ email: "a@example.com", notificationChannels: { email: false, slackWebhookUrl: SLACK } }, NOTE);
    assert.equal(result.channel, "slack");
    assert.equal(result.ok, false);
    assert.match(result.error, /500/);
  });
});

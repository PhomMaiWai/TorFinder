// End-to-end coverage for connecting LINE (backend/src/notifications), run in
// CI by .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// The webhook is driven exactly as LINE would call it: a JSON body signed with
// LINE_CHANNEL_SECRET. The backend's reply to the chat goes to the real LINE
// API with a fake token and fails — that is logged and ignored by design.
// Without LINE configured on the server, only the "refuses" checks run.

import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";

function makeToken(role, sub, email) {
  const payload = { sub, email, name: `CI ${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567", "admin@ci.test");
const lineUser = () => `U${randomBytes(16).toString("hex")}`;

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

// Must match LINE_WEBHOOK_THROTTLE_LIMIT in the workflow (backend default 300).
const WEBHOOK_LIMIT = Number(process.env.LINE_WEBHOOK_THROTTLE_LIMIT ?? "300");

/**
 * Posts events the way LINE does; `signature` overrides the real one. `ip` is
 * sent as X-Forwarded-For, as the frontend relay does; the backend trusts it
 * from loopback, so a test can stand in for a separate client.
 */
async function webhook(events, { signature, secret = LINE_SECRET, ip } = {}) {
  const raw = JSON.stringify({ destination: "Uxxxx", events });
  const res = await fetch(`${API}/line/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": signature ?? createHmac("sha256", secret).update(raw).digest("base64"),
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: raw,
  });
  return res.status;
}

const textFrom = (userId, text) => ({
  type: "message",
  replyToken: randomBytes(16).toString("hex"),
  source: { type: "user", userId },
  message: { type: "text", id: "1", text },
});

describe("LINE webhook", () => {
  it("refuses an unsigned or wrongly signed call", async () => {
    assert.equal(await webhook([], { signature: "" }), 401);
    assert.equal(await webhook([], { secret: "not-the-secret" }), 401);
  });

  it("refuses to start linking without a session", async () => {
    assert.equal((await api("/notifications/channels/line/link", { method: "POST" })).status, 401);
  });

  it("rate-limits a flood of forged calls from one client, but not other clients", async () => {
    // A documentation address (RFC 5737) of its own, so this flood doesn't
    // spend the bucket the other webhook tests use.
    const flooder = "192.0.2.77";
    const statuses = [];
    for (let i = 0; i < WEBHOOK_LIMIT + 5; i += 1) {
      statuses.push(await webhook([], { signature: "forged", ip: flooder }));
    }
    assert.equal(statuses[0], 401, "the first forged calls reach the signature check");
    assert.equal(statuses.at(-1), 429, "past the limit they are refused before it");
    assert.equal(await webhook([], { signature: "forged", ip: "192.0.2.78" }), 401, "another client is unaffected");
  });
});

describe("connecting LINE", { skip: !LINE_SECRET && "LINE_CHANNEL_SECRET not set" }, () => {
  let token;

  before(async () => {
    const email = `ci+line-${Date.now()}@example.com`;
    const signup = await api("/auth/signup", {
      method: "POST",
      body: {
        email,
        password: "Str0ngPass!",
        companyName: `CI LINE Co ${Date.now()}`,
        taxId: "0105563001236",
        contactName: "CI Runner",
        phone: "0812345678",
        address: "1 CI Street, Bangkok",
        specialty: "QA Automation",
        size: "11-50 คน",
      },
    });
    assert.equal(signup.status, 201, JSON.stringify(signup.body));
    const accounts = await api("/accounts", { token: ADMIN_TOKEN });
    const account = accounts.body.find((a) => a.email === email);
    token = makeToken("org", account.id, email);
  });

  const channels = async () => (await api("/notifications/channels", { token })).body;

  it("links the LINE user who sends the code, and only once", async () => {
    assert.equal((await channels()).available.line, true);

    const start = await api("/notifications/channels/line/link", { method: "POST", token });
    assert.equal(start.status, 200);
    const { code, messageUrl, addFriendUrl } = start.body;
    assert.match(code, /^TF-[A-Z2-9]{8}$/);
    assert.ok(messageUrl.endsWith(encodeURIComponent(code)));
    assert.match(addFriendUrl, /^https:\/\/line\.me\/R\/ti\/p\//);

    const me = lineUser();
    assert.equal(await webhook([textFrom(me, "hello")]), 200);
    assert.equal((await channels()).channels.lineUserId, undefined, "ordinary chat links nothing");

    assert.equal(await webhook([textFrom(me, code.toLowerCase())]), 200);
    const linked = await channels();
    assert.equal(linked.channels.lineUserId, me);
    assert.equal(linked.channels.email, false);

    // The code is spent: someone else sending it gets nothing.
    assert.equal(await webhook([textFrom(lineUser(), code)]), 200);
    assert.equal((await channels()).channels.lineUserId, me);
  });

  it("never takes a LINE id pasted into the settings", async () => {
    const linked = (await channels()).channels.lineUserId;
    assert.ok(linked);
    const res = await api("/notifications/channels", { method: "PUT", token, body: { lineUserId: lineUser() } });
    assert.equal(res.status, 200);
    assert.equal(res.body.channels.lineUserId, linked);
  });

  it("unlinks on request, and when the user blocks the OA", async () => {
    const unlinked = await api("/notifications/channels/line", { method: "DELETE", token });
    assert.equal(unlinked.status, 200);
    assert.equal(unlinked.body.channels.lineUserId, undefined);

    const { code } = (await api("/notifications/channels/line/link", { method: "POST", token })).body;
    const me = lineUser();
    await webhook([textFrom(me, code)]);
    assert.equal((await channels()).channels.lineUserId, me);

    assert.equal(await webhook([{ type: "unfollow", source: { type: "user", userId: me } }]), 200);
    assert.equal((await channels()).channels.lineUserId, undefined);
  });
});

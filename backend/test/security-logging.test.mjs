// Unit coverage for security logging and error handling (ASVS 16.x): the
// event line's shape, that a forged newline can't split a log line, and that
// an unexpected error reaches the client only as a generic message + errorId.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { AllExceptionsFilter } from "../dist/common/all-exceptions.filter.js";
import { logSecurityEvent } from "../dist/common/security-log.js";

/** Runs `fn` and returns everything it wrote to stdout and stderr. */
function captureOutput(fn) {
  const chunks = [];
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => (chunks.push(String(chunk)), true);
  process.stderr.write = (chunk) => (chunks.push(String(chunk)), true);
  try {
    fn();
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  return chunks.join("");
}

/** The JSON object inside a Nest log line. */
function eventIn(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  return JSON.parse(output.slice(start, end + 1));
}

function fakeHost() {
  const sent = {};
  const response = {
    headersSent: false,
    status(code) {
      sent.status = code;
      return this;
    },
    json(body) {
      sent.body = body;
      return this;
    },
  };
  const request = { method: "GET", path: "/api/thing" };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
  return { host, sent };
}

describe("logSecurityEvent", () => {
  it("writes one JSON line with the event, outcome and fields", () => {
    const output = captureOutput(() =>
      logSecurityEvent("auth.login", { outcome: "failure", email: "a@example.com", ip: "192.0.2.1", reason: "bad_credentials" }),
    );
    const event = eventIn(output);
    assert.equal(event.event, "auth.login");
    assert.equal(event.outcome, "failure");
    assert.equal(event.email, "a@example.com");
    assert.equal(event.ip, "192.0.2.1");
    assert.ok(!Number.isNaN(Date.parse(event.ts)), "has an ISO timestamp");
  });

  it("can't be split into a forged second line by a newline in user input", () => {
    const forged = 'x@example.com\n{"event":"auth.login","outcome":"success"}';
    const output = captureOutput(() => logSecurityEvent("auth.login", { outcome: "failure", email: forged }));
    const lines = output.split("\n").filter((line) => line.includes('"event"'));
    assert.equal(lines.length, 1, "still exactly one event line");
    assert.equal(eventIn(lines[0]).email, forged);
  });

  it("caps each field so one value can't flood the log", () => {
    const output = captureOutput(() => logSecurityEvent("auth.login", { outcome: "failure", email: "x".repeat(5000) }));
    assert.equal(eventIn(output).email.length, 254);
  });
});

describe("AllExceptionsFilter", () => {
  it("answers an unexpected error with a generic message and an errorId, never its details", () => {
    const { host, sent } = fakeHost();
    const secret = "connect ECONNREFUSED mongodb://torr:torr@db:27017";
    captureOutput(() => new AllExceptionsFilter().catch(new Error(secret), host));
    assert.equal(sent.status, 500);
    assert.match(sent.body.errorId, /^[0-9a-f-]{36}$/);
    assert.ok(!JSON.stringify(sent.body).includes("mongodb"), "no internals in the response");
  });

  it("logs the unexpected error's details on the server under the same errorId", () => {
    const { host, sent } = fakeHost();
    const output = captureOutput(() => new AllExceptionsFilter().catch(new Error("boom detail"), host));
    assert.ok(output.includes("boom detail"));
    assert.ok(output.includes(sent.body.errorId));
  });

  it("passes an HttpException's own body through unchanged", () => {
    const { host, sent } = fakeHost();
    captureOutput(() => new AllExceptionsFilter().catch(new BadRequestException("รหัสผ่านไม่ถูกต้อง"), host));
    assert.equal(sent.status, 400);
    assert.equal(sent.body.message, "รหัสผ่านไม่ถูกต้อง");
    assert.equal(sent.body.errorId, undefined);
  });
});

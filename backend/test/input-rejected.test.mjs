// ASVS 16.3.3: a request refused by input validation is logged as a security
// event naming the fields, never their values, while the client still gets
// the same 400 body as before. Loaded from dist — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { AllExceptionsFilter } from "../dist/common/all-exceptions.filter.js";
import { isRejectedInput, LoggingValidationPipe } from "../dist/common/logging-validation.pipe.js";

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

function fakeHost(request) {
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
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
  return { host, sent };
}

/** What class-validator reports for a bad email and a bad nested phone number. */
const ERRORS = [
  { property: "email", value: "not-an-email<script>", constraints: { isEmail: "email must be an email" }, children: [] },
  {
    property: "company",
    value: {},
    children: [{ property: "phone", value: "123", constraints: { isThaiPhone: "เบอร์โทรไม่ถูกต้อง" }, children: [] }],
  },
];

describe("input rejected by validation (ASVS 16.3.3)", () => {
  const exception = new LoggingValidationPipe({ whitelist: true }).createExceptionFactory()(ERRORS);

  it("is a normal 400 that also names the refused fields", () => {
    assert.ok(exception instanceof BadRequestException);
    assert.ok(isRejectedInput(exception));
    assert.deepEqual(exception.rejectedFields, ["email", "company.phone"]);
  });

  it("is logged as input.rejected with the path, IP and fields, but no submitted value", () => {
    const { host, sent } = fakeHost({ method: "POST", path: "/api/auth/signup", ip: "192.0.2.9" });
    const output = captureOutput(() => new AllExceptionsFilter().catch(exception, host));
    const line = output.split("\n").find((l) => l.includes("input.rejected"));
    assert.ok(line, "an input.rejected event was written");
    assert.match(line, /invalid_fields:email,company\.phone/);
    assert.match(line, /\/api\/auth\/signup/);
    assert.match(line, /192\.0\.2\.9/);
    assert.doesNotMatch(output, /not-an-email/);
    assert.equal(sent.status, 400);
    assert.deepEqual(sent.body.message, ["email must be an email", "company.เบอร์โทรไม่ถูกต้อง"]);
  });

  it("leaves other 400s (a business rule saying no) out of the security log", () => {
    const { host } = fakeHost({ method: "POST", path: "/api/x", ip: "192.0.2.9" });
    const output = captureOutput(() => new AllExceptionsFilter().catch(new BadRequestException("ปิดรับแล้ว"), host));
    assert.doesNotMatch(output, /input\.rejected/);
  });
});

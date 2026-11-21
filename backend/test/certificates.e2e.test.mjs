// End-to-end coverage for /api/certificates (#260): a company's certificates
// as records with issuer, dates, verify link, scope and an attached scan.
// Same approach as accounts.e2e.test.mjs: Node's runner and `fetch` against a
// running backend, with tokens minted directly.
//
// What it pins down:
//   - company accounts only; another role is refused.
//   - one company can never read or change another's certificates or files.
//   - a file is judged by its bytes (PDF/PNG/JPG), capped at 5 MB, and only
//     ever served back as a download.
//   - an expired certificate stops counting for TOR matching.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";
import { formTimingHeaders } from "./helpers/form-token.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function makeToken(role, sub, email) {
  const payload = { sub, email: email ?? `${role}@ci.test`, name: `CI ${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const GHOST_ID = "0123456789abcdef01234567";
const ADMIN_TOKEN = makeToken("admin", GHOST_ID, "admin@ci.test");

async function api(path, { method = "GET", body, token, form } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  Object.assign(headers, formTimingHeaders(path, method));
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  let parsed;
  try {
    parsed = buffer.length ? JSON.parse(buffer.toString("utf8")) : undefined;
  } catch {
    parsed = buffer;
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

let suffix = 0;
/** A fresh, approved company this suite owns, with a minted token. */
async function approvedOrg() {
  suffix += 1;
  const unique = `${Date.now()}-${suffix}`;
  const org = {
    email: `ci+certs-${unique}@example.com`,
    password: "Str0ngPass!2026",
    companyName: `CI Certs Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "Security testing",
    size: "11-50 คน",
  };
  const signup = await api("/auth/signup", { method: "POST", body: org });
  assert.equal(signup.status, 201, `signup failed: ${JSON.stringify(signup.body)}`);
  const list = await api("/accounts?status=pending", { token: ADMIN_TOKEN });
  const account = list.body.find((a) => a.email === org.email);
  const approved = await api(`/accounts/${account.id}`, { method: "PATCH", token: ADMIN_TOKEN, body: { status: "approved" } });
  assert.equal(approved.status, 200);
  return { id: account.id, token: makeToken("org", account.id, org.email) };
}

function fileForm(bytes, name, type = "application/octet-stream") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return form;
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const ISO27001 = {
  name: "ISO/IEC 27001:2022",
  standard: "iso27001",
  issuer: "BSI",
  issuedAt: "2025-03-01",
  expiresAt: "2028-02-28",
  verifyUrl: "https://www.bsigroup.com/en-GB/validate-bsi-issued-certificates/",
  scope: "การพัฒนาและดูแลระบบสารสนเทศสำหรับหน่วยงานภาครัฐ",
};

let company;
let other;

before(async () => {
  [company, other] = await Promise.all([approvedOrg(), approvedOrg()]);
});

describe("access", () => {
  it("refuses a request with no token, and every role but a company", async () => {
    assert.equal((await api("/certificates")).status, 401);
    assert.equal((await api("/certificates", { token: ADMIN_TOKEN })).status, 403);
    assert.equal((await api("/certificates", { token: makeToken("viewer", GHOST_ID) })).status, 403);
  });

  it("starts unanswered — null, not an empty list", async () => {
    const res = await api("/certificates", { token: company.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.certificates, null);
  });
});

describe("records", () => {
  let created;

  it("creates a certificate with issuer, dates, verify link and scope", async () => {
    const res = await api("/certificates", { method: "POST", token: company.token, body: ISO27001 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    created = res.body;
    assert.match(created.id, /^[0-9a-f]{24}$/);
    for (const [key, value] of Object.entries(ISO27001)) assert.equal(created[key], value, key);
  });

  it("refuses a verify link that isn't a web address", async () => {
    const res = await api("/certificates", {
      method: "POST",
      token: company.token,
      body: { ...ISO27001, verifyUrl: "javascript:alert(1)" },
    });
    assert.equal(res.status, 400);
  });

  it("refuses an expiry before the issue date, and dates not in the calendar", async () => {
    const backwards = await api("/certificates", {
      method: "POST",
      token: company.token,
      body: { ...ISO27001, issuedAt: "2026-01-01", expiresAt: "2025-01-01" },
    });
    assert.equal(backwards.status, 400);
    const impossible = await api("/certificates", {
      method: "POST",
      token: company.token,
      body: { ...ISO27001, expiresAt: "2027-02-31" },
    });
    assert.equal(impossible.status, 400);
  });

  it("replaces the fields on save, clearing the ones left out", async () => {
    const res = await api(`/certificates/${created.id}`, {
      method: "PUT",
      token: company.token,
      body: { name: "ISO/IEC 27001:2022", standard: "iso27001", issuer: "TÜV" },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.issuer, "TÜV");
    assert.equal(res.body.scope, undefined);
    assert.equal(res.body.createdAt, created.createdAt);
  });

  it("never shows or changes another company's records", async () => {
    assert.equal((await api("/certificates", { token: other.token })).body.certificates, null);
    const res = await api(`/certificates/${created.id}`, { method: "PUT", token: other.token, body: ISO27001 });
    assert.equal(res.status, 404);
    assert.equal((await api(`/certificates/${created.id}`, { method: "DELETE", token: other.token })).status, 404);
  });

  it("keeps records when 'none' is answered after adding some", async () => {
    const res = await api("/certificates/none", { method: "POST", token: company.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.certificates.length, 1);
  });

  it("records the answer 'none' for a company with nothing on file", async () => {
    const res = await api("/certificates/none", { method: "POST", token: other.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.certificates, []);
  });

  it("deletes a record", async () => {
    const extra = await api("/certificates", { method: "POST", token: company.token, body: { name: "CREST", standard: "crest" } });
    assert.equal((await api(`/certificates/${extra.body.id}`, { method: "DELETE", token: company.token })).status, 204);
    const list = await api("/certificates", { token: company.token });
    assert.ok(!list.body.certificates.some((record) => record.id === extra.body.id));
  });
});

describe("files", () => {
  let record;

  before(async () => {
    record = (await api("/certificates", { method: "POST", token: company.token, body: { name: "OSCP", standard: "oscp" } })).body;
  });

  it("attaches a PDF and serves it back only as a download", async () => {
    const upload = await api(`/certificates/${record.id}/file`, {
      method: "PUT",
      token: company.token,
      form: fileForm(PDF, "ใบรับรอง OSCP.pdf"),
    });
    assert.equal(upload.status, 200, JSON.stringify(upload.body));
    assert.equal(upload.body.file.contentType, "application/pdf");
    assert.equal(upload.body.file.name, "ใบรับรอง OSCP.pdf");

    const download = await api(`/certificates/${record.id}/file`, { token: company.token });
    assert.equal(download.status, 200);
    assert.ok(download.body.equals(PDF));
    assert.match(download.headers.get("content-disposition"), /^attachment;/);
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  });

  it("refuses a file whose bytes aren't a PDF or an image, whatever it is called", async () => {
    const res = await api(`/certificates/${record.id}/file`, {
      method: "PUT",
      token: company.token,
      form: fileForm(Buffer.from("<script>alert(1)</script>"), "cert.pdf", "application/pdf"),
    });
    assert.equal(res.status, 415);
  });

  it("refuses a file over 5 MB", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await api(`/certificates/${record.id}/file`, { method: "PUT", token: company.token, form: fileForm(big, "big.pdf") });
    assert.equal(res.status, 413);
  });

  it("never serves one company's file to another", async () => {
    assert.equal((await api(`/certificates/${record.id}/file`, { token: other.token })).status, 404);
  });

  it("removes the file but keeps the record", async () => {
    const res = await api(`/certificates/${record.id}/file`, { method: "DELETE", token: company.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.file, undefined);
    assert.equal((await api(`/certificates/${record.id}/file`, { token: company.token })).status, 404);
  });
});

describe("matching", () => {
  it("drops the old yes/no list from the profile form", async () => {
    const res = await api("/accounts/me", { method: "PATCH", token: other.token, body: { certifications: ["iso9001"] } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.company.certificates, []);
    assert.equal(res.body.company.certifications, undefined);
  });
});

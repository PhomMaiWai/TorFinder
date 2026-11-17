// End-to-end coverage for /api/library (#259): past projects and team
// members with their files, coverage of a TOR's qualifications, and the
// starter pack. Same approach as certificates.e2e.test.mjs: Node's runner and
// `fetch` against a running backend, with tokens minted directly; the TOR is
// written straight to MongoDB so it can carry extracted qualifications.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");

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
  const res = await fetch(`${API}${path}`, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
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
async function approvedOrg() {
  suffix += 1;
  const unique = `${Date.now()}-${suffix}`;
  const org = {
    email: `ci+library-${unique}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Library Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "Software",
    size: "11-50 คน",
  };
  assert.equal((await api("/auth/signup", { method: "POST", body: org })).status, 201);
  const account = (await api("/accounts?status=pending", { token: ADMIN_TOKEN })).body.find((a) => a.email === org.email);
  assert.equal((await api(`/accounts/${account.id}`, { method: "PATCH", token: ADMIN_TOKEN, body: { status: "approved" } })).status, 200);
  return { id: account.id, token: makeToken("org", account.id, org.email) };
}

function fileForm(bytes, name) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  return form;
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const PROJECT = {
  title: "ระบบบริการประชาชนออนไลน์",
  client: "สำนักงานเขตตัวอย่าง",
  clientType: "government",
  value: 4_000_000,
  startedAt: "2024-01-01",
  completedAt: "2024-12-31",
  workTypes: ["eservice"],
  description: "พัฒนาและดูแลระบบยื่นคำขอออนไลน์",
};
const MEMBER = { name: "สมชาย ใจดี", position: "ผู้จัดการโครงการ", yearsExperience: 8, certifications: ["pmp"], education: "ปริญญาโท" };

let company;
let other;
let torId;

before(async () => {
  await mongo.connect();
  [company, other] = await Promise.all([approvedOrg(), approvedOrg()]);
  const { insertedId } = await mongo.db().collection("tors").insertOne({
    title: "จ้างพัฒนาระบบบริการประชาชน (CI library)",
    agency: "สำนักงานเขตทดสอบ",
    summary: "CI",
    createdAt: new Date(),
    extraction: {
      qualifications: [
        "มีผลงานกับหน่วยงานของรัฐ วงเงินไม่น้อยกว่า 3,000,000 บาท",
        "ผู้จัดการโครงการ × 1 คน — ประสบการณ์ไม่น้อยกว่า 5 ปี มีใบรับรอง PMP",
        "ได้รับการรับรองมาตรฐาน ISO/IEC 27001",
        "คุณสมบัติทั่วไปตามระเบียบพัสดุภาครัฐ",
      ],
    },
  });
  torId = insertedId.toString();
});

after(async () => {
  await mongo.db().collection("tors").deleteOne({ _id: new ObjectId(torId) });
  await mongo.close();
});

describe("access", () => {
  it("refuses everyone but a company", async () => {
    assert.equal((await api("/library")).status, 403);
    assert.equal((await api("/library", { token: ADMIN_TOKEN })).status, 403);
  });

  it("starts empty", async () => {
    const res = await api("/library", { token: company.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { pastProjects: [], teamMembers: [], certificates: [] });
  });

  it("answers 404 for a kind that doesn't exist", async () => {
    assert.equal((await api("/library/secrets", { method: "POST", token: company.token, body: {} })).status, 404);
  });
});

describe("records", () => {
  let project;
  let member;

  it("creates a past project and a team member", async () => {
    const p = await api("/library/projects", { method: "POST", token: company.token, body: PROJECT });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    project = p.body;
    for (const [key, value] of Object.entries(PROJECT)) assert.deepEqual(project[key], value, key);

    const m = await api("/library/team", { method: "POST", token: company.token, body: MEMBER });
    assert.equal(m.status, 201, JSON.stringify(m.body));
    member = m.body;
  });

  it("validates each kind by its own rules", async () => {
    assert.equal((await api("/library/team", { method: "POST", token: company.token, body: { name: "x" } })).status, 400);
    assert.equal(
      (await api("/library/projects", { method: "POST", token: company.token, body: { ...PROJECT, clientType: "alien" } })).status,
      400,
    );
    assert.equal(
      (await api("/library/projects", {
        method: "POST",
        token: company.token,
        body: { ...PROJECT, startedAt: "2025-01-01", completedAt: "2024-01-01" },
      })).status,
      400,
    );
  });

  it("drops fields that aren't part of the record", async () => {
    const res = await api(`/library/team/${member.id}`, { method: "PUT", token: company.token, body: { ...MEMBER, role: "admin" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, undefined);
  });

  it("never shows or changes another company's records", async () => {
    assert.deepEqual((await api("/library", { token: other.token })).body.pastProjects, []);
    assert.equal((await api(`/library/projects/${project.id}`, { method: "PUT", token: other.token, body: PROJECT })).status, 404);
    assert.equal((await api(`/library/projects/${project.id}/file`, { token: other.token })).status, 404);
  });

  it("attaches a CV and serves it back only as a download", async () => {
    const upload = await api(`/library/team/${member.id}/file`, { method: "PUT", token: company.token, form: fileForm(PDF, "CV สมชาย.pdf") });
    assert.equal(upload.status, 200, JSON.stringify(upload.body));
    assert.equal(upload.body.file.name, "CV สมชาย.pdf");

    const download = await api(`/library/team/${member.id}/file`, { token: company.token });
    assert.equal(download.status, 200);
    assert.ok(download.body.equals(PDF));
    assert.match(download.headers.get("content-disposition"), /^attachment;/);
  });

  it("refuses a file whose bytes aren't a document", async () => {
    const res = await api(`/library/projects/${project.id}/file`, {
      method: "PUT",
      token: company.token,
      form: fileForm(Buffer.from("MZ\x90\x00 not a pdf"), "letter.pdf"),
    });
    assert.equal(res.status, 415);
  });

  it("deletes a record", async () => {
    const extra = await api("/library/projects", { method: "POST", token: company.token, body: { title: "ลบทิ้ง" } });
    assert.equal((await api(`/library/projects/${extra.body.id}`, { method: "DELETE", token: company.token })).status, 204);
  });
});

describe("coverage and starter pack", () => {
  it("says which qualifications the library covers", async () => {
    const res = await api(`/library/coverage/${torId}`, { token: company.token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.extracted, true);
    assert.deepEqual(
      res.body.items.map((item) => item.status),
      ["ready", "ready", "missing", "manual"],
    );
    assert.equal(res.body.ready, 2);
    assert.equal(res.body.total, 4);
  });

  it("answers 404 for a TOR that doesn't exist", async () => {
    assert.equal((await api(`/library/coverage/${GHOST_ID}`, { token: company.token })).status, 404);
  });

  it("packs the checklist and the cited files into a ZIP", async () => {
    const res = await api(`/library/starter-pack/${torId}`, { token: company.token });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/zip");
    assert.match(res.headers.get("content-disposition"), /^attachment; filename="starter-pack-/);
    const zip = res.body;
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    const text = zip.toString("utf8");
    assert.ok(text.includes("00-รายการตรวจความพร้อม.html"));
    assert.ok(text.includes("3-บุคลากร/สมชาย ใจดี - CV.pdf"));
  });
});

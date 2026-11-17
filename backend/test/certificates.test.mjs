// Unit coverage for certificates as records (#260): which certificates count
// today, the new cybersecurity and AI requirements, the expired-certificate
// verdict, and the upload checks. Imported from the compiled build (run after
// `npm run build`, as CI does), the same way matching-scoring.test.mjs is.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bangkokToday, heldCertifications } from "../dist/certificates/certificate.types.js";
import { safeFileName, sniffCertificateFile } from "../dist/certificates/certificates.service.js";
import { scoreMatch } from "../dist/matching/matching.scoring.js";
import { requirementsOf } from "../dist/matching/requirements.js";

const TODAY = "2026-11-17";

function record(fields) {
  return { id: "x", name: "cert", createdAt: new Date(), updatedAt: new Date(), ...fields };
}

describe("heldCertifications", () => {
  it("is unknown until the company answers", () => {
    assert.deepEqual(heldCertifications({}, TODAY), { held: undefined, expired: [] });
  });

  it("reads the old yes/no list while there are no records", () => {
    assert.deepEqual(heldCertifications({ certifications: ["iso9001"] }, TODAY), { held: ["iso9001"], expired: [] });
  });

  it("lets records decide once there are any — an empty list is the answer none", () => {
    assert.deepEqual(heldCertifications({ certifications: ["iso9001"], certificates: [] }, TODAY), {
      held: [],
      expired: [],
    });
  });

  it("counts a certificate on its expiry day, and not the day after", () => {
    const company = { certificates: [record({ standard: "iso27001", expiresAt: TODAY })] };
    assert.deepEqual(heldCertifications(company, TODAY).held, ["iso27001"]);
    assert.deepEqual(heldCertifications(company, "2026-11-18"), { held: [], expired: ["iso27001"] });
  });

  it("treats a renewal as held even when the old certificate is still on file", () => {
    const company = {
      certificates: [
        record({ standard: "iso27001", expiresAt: "2025-01-01" }),
        record({ standard: "iso27001", expiresAt: "2028-01-01" }),
      ],
    };
    assert.deepEqual(heldCertifications(company, TODAY), { held: ["iso27001"], expired: [] });
  });

  it("ignores records that meet no matchable standard", () => {
    const company = { certificates: [record({ name: "ใบรับรองอบรมภายใน" })] };
    assert.deepEqual(heldCertifications(company, TODAY), { held: [], expired: [] });
  });
});

describe("bangkokToday", () => {
  it("rolls over at midnight Bangkok time, not UTC", () => {
    assert.equal(bangkokToday(new Date("2026-11-16T17:30:00Z")), "2026-11-17");
    assert.equal(bangkokToday(new Date("2026-11-16T16:30:00Z")), "2026-11-16");
  });
});

describe("requirementsOf — cybersecurity and AI certificates", () => {
  it("reads pentest certificates named as alternatives as one requirement", () => {
    const { certifications } = requirementsOf(["ผู้ทดสอบเจาะระบบต้องมีใบรับรอง OSCP หรือ CEH หรือ GPEN"]);
    assert.deepEqual(certifications, [["oscp", "ceh", "giac"]]);
  });

  it("reads CREST and AWS / NVIDIA AI certificates", () => {
    const { certifications } = requirementsOf([
      "บริษัทต้องได้รับการรับรอง CREST",
      "มีบุคลากรที่ได้รับ AWS Certified Machine Learning – Specialty",
      "มีบุคลากรที่ได้รับ NVIDIA-Certified Associate: Generative AI",
    ]);
    assert.deepEqual(certifications, [["crest"], ["awsAi"], ["nvidiaAi"]]);
  });

  it("does not read a bare vendor name as an AI certificate", () => {
    const { certifications } = requirementsOf(["ติดตั้งระบบบน AWS และการ์ดจอ NVIDIA"]);
    assert.deepEqual(certifications, []);
  });

  it("keeps Security+ and PenTest+ apart", () => {
    assert.deepEqual(requirementsOf(["CompTIA PenTest+"]).certifications, [["pentestplus"]]);
    assert.deepEqual(requirementsOf(["CompTIA Security+"]).certifications, [["securityplus"]]);
  });
});

describe("scoreMatch — an expired certificate", () => {
  const TOR = {
    title: "จ้างทดสอบเจาะระบบ",
    budgetAmount: 1_000_000,
    extraction: { qualifications: ["ได้รับการรับรองมาตรฐาน ISO/IEC 27001"] },
  };

  it("fails the requirement and says why", () => {
    const result = scoreMatch(TOR, {
      companyName: "Lapsed Co",
      workTypes: [],
      certifications: [],
      expiredCertifications: ["iso27001"],
    });
    assert.equal(result.eligible, false);
    assert.deepEqual(result.eligibility, [
      { requirement: "ISO/IEC 27001 (ใบรับรองของบริษัทหมดอายุแล้ว)", status: "fail" },
    ]);
  });
});

describe("upload checks", () => {
  it("knows a file by its bytes, not its name", () => {
    assert.equal(sniffCertificateFile(Buffer.from("%PDF-1.7\n")), "application/pdf");
    assert.equal(sniffCertificateFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "image/png");
    assert.equal(sniffCertificateFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffCertificateFile(Buffer.from("<html><script>alert(1)</script>")), null);
    assert.equal(sniffCertificateFile(Buffer.from("MZ\x90\x00")), null);
  });

  it("keeps a display name only, with the extension of what the file really is", () => {
    assert.equal(safeFileName("../../etc/ISO 27001.pdf", "application/pdf"), "ISO 27001.pdf");
    assert.equal(safeFileName('C:\\scans\\cert".exe', "image/png"), "cert.png");
    assert.equal(safeFileName("", "image/jpeg"), "certificate.jpg");
  });
});

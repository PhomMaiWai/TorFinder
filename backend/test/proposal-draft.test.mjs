// Unit coverage for the proposal-draft prompt — imported from the compiled
// build (run after `npm run build`, as CI does). No model is called.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { proposalPrompt, sanitizeDraft } from "../dist/ai/proposal-draft.js";

const TOR = {
  title: "จ้างพัฒนาระบบรับเรื่องร้องเรียน",
  agency: "สำนักงานเขตบางรัก",
  summary: "สรุปจากประกาศ",
  referencePrice: 2_500_000,
  extraction: {
    scope: "พัฒนาระบบรับเรื่องร้องเรียนผ่าน LINE OA",
    qualifications: ["ได้รับการรับรอง ISO/IEC 27001"],
    deliverables: ["ระบบรับเรื่อง", "คู่มือการใช้งาน"],
  },
};

describe("proposal draft", () => {
  it("puts the TOR, the company and the earlier proposal in front of the model", () => {
    const prompt = proposalPrompt(
      TOR,
      { companyName: "บริษัท ทดสอบ จำกัด", certifications: ["iso27001"], workTypes: ["web"] },
      "ข้อเสนอเดิม: ระบบ e-Service ของเทศบาล",
    );
    assert.match(prompt, /พัฒนาระบบรับเรื่องร้องเรียนผ่าน LINE OA/);
    assert.match(prompt, /ISO\/IEC 27001/);
    assert.match(prompt, /บริษัท ทดสอบ จำกัด/);
    assert.match(prompt, /ระบบ e-Service ของเทศบาล/);
  });

  it("falls back to the summary when nothing was extracted", () => {
    const prompt = proposalPrompt({ ...TOR, extraction: null }, undefined, "เดิม");
    assert.match(prompt, /สรุปจากประกาศ/);
    assert.match(prompt, /ไม่มีข้อมูลบริษัท/);
  });

  it("drops empty sections and blank gaps", () => {
    const draft = sanitizeDraft({
      sections: [{ heading: "ก", body: "เนื้อหา" }, { heading: "ข", body: "  " }, null],
      gaps: ["ขาดใบรับรอง", ""],
    });
    assert.deepEqual(draft, { sections: [{ heading: "ก", body: "เนื้อหา" }], gaps: ["ขาดใบรับรอง"] });
  });
});

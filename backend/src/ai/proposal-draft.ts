import { Type, type Schema } from "@google/genai";

import { CompanyProfile } from "../database/database.service";
import { CERTIFICATIONS } from "../matching/requirements";
import { workTypeLabel } from "../matching/work-types";
import { formatBaht } from "../tor/tor-normalize";

/** The longest earlier proposal accepted — a few dozen pages of text. */
export const MAX_PREVIOUS_PROPOSAL = 20_000;

/** What the draft is written against; structural so a TorDoc fits as-is. */
export type DraftTor = {
  title: string;
  agency: string;
  summary: string;
  budgetAmount?: number;
  referencePrice?: number;
  extraction?: {
    scope?: string | null;
    objectives?: string[];
    qualifications?: string[];
    deliverables?: string[];
    evaluationCriteria?: string | null;
    contractPeriod?: string | null;
  } | null;
};

export type ProposalDraft = {
  sections: { heading: string; body: string }[];
  /** What the TOR asks that neither the old proposal nor the profile covers. */
  gaps: string[];
};

export const PROPOSAL_INSTRUCTION = `คุณคือผู้ช่วยเขียนข้อเสนอโครงการ (Proposal) สำหรับการยื่นประกวดราคาภาครัฐของไทย
เขียนร่างข้อเสนอฉบับใหม่ให้ตรงกับ TOR ที่ให้มา โดยนำเนื้อหา ผลงาน วิธีการทำงาน และทีมงานจากข้อเสนอเดิมของบริษัทมาปรับใช้
- เขียนเป็นภาษาไทยแบบทางการ ใช้ศัพท์เทคนิคภาษาอังกฤษได้ตามปกติของวงการไอที
- ทุกหัวข้อต้องตอบขอบเขตงาน สิ่งที่ต้องส่งมอบ และคุณสมบัติที่ TOR กำหนด
- ห้ามแต่งผลงาน ตัวเลข ใบรับรอง หรือชื่อบุคลากรที่ไม่มีในข้อเสนอเดิมหรือข้อมูลบริษัท ถ้าขาดให้เว้นเป็น [กรอกเพิ่ม: ...] และใส่ไว้ใน gaps
- ใบรับรองอย่าง ISO เป็นของบริษัท ไม่ใช่ของบุคคล
- ไม่ต้องเสนอราคาในร่างนี้`;

export const PROPOSAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ["heading", "body"],
      },
    },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["sections", "gaps"],
};

const bullets = (items: string[] | undefined) => (items?.length ? items.map((item) => `- ${item}`).join("\n") : "-");

/** Everything the model writes from, laid out as labelled plain text. */
export function proposalPrompt(tor: DraftTor, company: CompanyProfile | undefined, previous: string): string {
  const e = tor.extraction;
  const price = tor.referencePrice ?? tor.budgetAmount;

  const companyFacts = company
    ? [
        `ชื่อบริษัท: ${company.companyName}`,
        company.specialty && `ความเชี่ยวชาญ: ${company.specialty}`,
        company.workTypes?.length && `ประเภทงาน: ${company.workTypes.map(workTypeLabel).join(", ")}`,
        company.certifications?.length &&
          `ใบรับรองของบริษัท: ${company.certifications.map((key) => CERTIFICATIONS[key].label).join(", ")}`,
        company.largestPastContract && `ผลงานมูลค่าสูงสุด: ${formatBaht(company.largestPastContract)}`,
        company.pastExperience && `ผลงานที่ผ่านมา: ${company.pastExperience}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "ไม่มีข้อมูลบริษัท";

  return `# TOR ที่จะยื่น
ชื่อโครงการ: ${tor.title}
หน่วยงาน: ${tor.agency}
${price ? `ราคากลาง/วงเงิน: ${formatBaht(price)}` : ""}
ระยะเวลาสัญญา: ${e?.contractPeriod ?? "-"}

ขอบเขตงาน:
${e?.scope ?? tor.summary}

วัตถุประสงค์:
${bullets(e?.objectives)}

คุณสมบัติผู้ยื่นข้อเสนอ:
${bullets(e?.qualifications)}

สิ่งที่ต้องส่งมอบ:
${bullets(e?.deliverables)}

เกณฑ์การพิจารณา: ${e?.evaluationCriteria ?? "-"}

# ข้อมูลบริษัท
${companyFacts}

# ข้อเสนอเดิมของบริษัท (นำมาปรับใช้)
${previous}

เขียนร่างข้อเสนอโดยมีหัวข้อ: ความเข้าใจโครงการ, แนวทางและวิธีการดำเนินงาน, สถาปัตยกรรมระบบ, แผนการดำเนินงานและการส่งมอบ, ทีมงานและบุคลากร, ผลงานที่ผ่านมา, การบริหารความเสี่ยงและความปลอดภัยของข้อมูล, การรับประกันและบำรุงรักษา`;
}

/** Keeps only well-formed sections; the model occasionally returns empty ones. */
export function sanitizeDraft(raw: Partial<ProposalDraft>): ProposalDraft {
  const sections = (raw.sections ?? []).filter(
    (section) => typeof section?.heading === "string" && typeof section?.body === "string" && section.body.trim(),
  );
  const gaps = (raw.gaps ?? []).filter((gap): gap is string => typeof gap === "string" && gap.trim() !== "");
  return { sections, gaps };
}

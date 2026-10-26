/**
 * A bidding document lists who may bid as one long run of lines, but they ask
 * about different things: the company itself, the certifications it holds,
 * the work it has done, and the people it puts on the project. A company
 * checks each against a different part of itself, so the detail page reads
 * them apart.
 */
export type QualificationGroup = "company" | "certification" | "experience" | "personnel";

/** Held by the company as a whole — an ISO audit certifies an organisation, never a person. */
const COMPANY_CERTIFICATION = /ISO|IEC|CMMI|มาตรฐาน.{0,10}(?:ระบบ|การจัดการ)|ตัวแทนจำหน่าย/i;
const PERSONNEL =
  /บุคลากร|ทีมงาน|ผู้เชี่ยวชาญ|ผู้จัดการโครงการ|วิศวกร|โปรแกรมเมอร์|นักพัฒนา|นักวิเคราะห์|วุฒิ|ปริญญา|developer|designer|engineer|manager|analyst|CISSP|PMP|อย่างน้อย\s*\d+\s*คน/i;
const EXPERIENCE = /ผลงาน|ประสบการณ์|เคย|สัญญา/;

function groupOf(line: string): QualificationGroup {
  // Personnel first: "ทีมงานมีใบรับรอง CISSP" is a person's certificate, not the company's.
  if (PERSONNEL.test(line)) return "personnel";
  if (COMPANY_CERTIFICATION.test(line)) return "certification";
  if (EXPERIENCE.test(line)) return "experience";
  return "company";
}

export const QUALIFICATION_GROUPS: readonly QualificationGroup[] = [
  "company",
  "certification",
  "experience",
  "personnel",
];

export function groupQualifications(lines: string[]): Record<QualificationGroup, string[]> {
  const groups: Record<QualificationGroup, string[]> = {
    company: [],
    certification: [],
    experience: [],
    personnel: [],
  };
  for (const line of lines) groups[groupOf(line)].push(line);
  return groups;
}

/**
 * How bids are judged: on price alone, or on price weighed against the
 * proposal's quality (เกณฑ์ราคาประกอบเกณฑ์อื่น / Price Performance). The two
 * call for different bids — one is won by the lowest price, the other by the
 * best proposal at a defensible one.
 */
export type EvaluationMethod = "price" | "pricePerformance";

const PRICE_PERFORMANCE = /ประกอบเกณฑ์|เกณฑ์อื่น|price\s*performance|คุณภาพ|ข้อเสนอทางเทคนิค|คะแนนด้านเทคนิค/i;
const PRICE_ONLY = /เกณฑ์ราคา|ราคาต่ำสุด|ราคารวมต่ำสุด|lowest\s*price/i;

export function evaluationMethodOf(criteria: string | null | undefined): EvaluationMethod | null {
  if (!criteria) return null;
  if (PRICE_PERFORMANCE.test(criteria)) return "pricePerformance";
  if (PRICE_ONLY.test(criteria)) return "price";
  return null;
}
